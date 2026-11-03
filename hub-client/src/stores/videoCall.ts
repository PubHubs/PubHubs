import { useRooms } from './rooms';
import {
	AudioPresets,
	DefaultReconnectPolicy,
	Room as LiveKitRoom,
	type LocalAudioTrack,
	type LocalVideoTrack,
	type Participant,
	type RemoteParticipant,
	type RoomOptions,
	ScreenSharePresets,
	Track,
	type TrackPublishDefaults,
	type VideoPreset,
	VideoPresets,
	createLocalAudioTrack,
	createLocalVideoTrack,
	isE2EESupported,
} from 'livekit-client';
import { type MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { defineStore } from 'pinia';
import { markRaw } from 'vue';

import { createE2EEWorker } from '@hub-client/logic/core/e2eeWorker';
import { VideocallStateType } from '@hub-client/logic/core/events';
import { MatrixKeyProvider } from '@hub-client/logic/core/matrixKeyProvider';
import { router } from '@hub-client/logic/core/router';
import { trackCallMembers } from '@hub-client/logic/core/trackCallMembers';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

const logger = createLogger('Videocall');

const defaultLiveKitPublishOptions: TrackPublishDefaults = {
	audioPreset: AudioPresets.music,
	dtx: true,
	// disable red because the livekit server strips out red packets for clients
	// that don't support it (firefox) but of course that doesn't work with e2ee.
	red: false,
	forceStereo: false,
	simulcast: true,
	videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
	screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
	stopMicTrackOnMute: false,
	videoCodec: 'vp9',
	videoEncoding: VideoPresets.h720.encoding,
} as const;

export const defaultLiveKitOptions: RoomOptions = {
	adaptiveStream: true,
	dynacast: true,
	videoCaptureDefaults: {
		resolution: VideoPresets.h720.resolution,
	},
	publishDefaults: defaultLiveKitPublishOptions,
	stopLocalTrackOnUnpublish: true,
	reconnectPolicy: new DefaultReconnectPolicy(),
	disconnectOnPageLeave: true,
	webAudioMix: false,
};

const MembershipExpiryTime = 5 * 60 * 1000; // 5 minutes
let endCallCleanup: (() => void) | null = null; // Kept outside of state to avoid being wrapped in Vue's reactive proxy, not accessible outside this module
let e2eeWorker: Worker | null = null; // Outside state for the same reason as endCallCleanup

const useVideoCall = defineStore('videoCall', {
	state: () => {
		return {
			token: null as string | null,
			target_url: null as string | null,
			should_publish_audio_track: false,
			should_publish_video_track: false,
			rtc_session: null as MatrixRTCSession | null,

			eventId: null as string | null,

			matrix_key_provider: null as MatrixKeyProvider | null,
			livekit_room: null as LiveKitRoom | null,
			options: { ...defaultLiveKitOptions } as RoomOptions,

			audio_track: null as LocalAudioTrack | null,
			selected_audio_device_id: null as string | null,
			mute_audio_track: false,
			video_track: null as LocalVideoTrack | null,
			selected_video_device_id: null as string | null,
			mute_video_track: false,
			selected_output_device_id: null as string | null,

			screen_share: false,
			participant_count: 0,

			locally_muted_participants: [] as string[],
			undecryptable_participants: [] as string[], // LiveKit identities whose media we cannot decrypt
			selfView: true,
			focus: [null, false] as [Participant | null, boolean],
			_connecting: false,
			_leaving: false,
		};
	},

	getters: {
		/** Calls are always end-to-end encrypted; a session that cannot encrypt may not join. */
		e2eeBlocked(): boolean {
			return !isE2EESupported() || !usePubhubsStore().e2eeAvailable;
		},
	},

	actions: {
		getRemoteParticipant(id: string): RemoteParticipant | undefined {
			return this.livekit_room?.remoteParticipants.get(id) as RemoteParticipant;
		},

		async startCall(): Promise<boolean> {
			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return false;

			// only start of the call, do not join yet
			try {
				await currentRoom.initializeCall();
			} catch (error) {
				logger.error('Initializing call failed ', error);
				return false;
			}

			return true;
		},

		async joinCall(message?: string): Promise<boolean> {
			const rooms = useRooms();
			const pubhubs = usePubhubsStore();

			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return false;

			// Decide before joining: the session recalculates its members asynchronously, so right after joining it may
			// not count our own membership yet, or still hold the previous call's.
			const startsNewCall = !(await this.someoneElseInCall());

			const connected = await this.connectToCall();
			if (!connected) return false;

			// on demand getting single instance, because the store has no setup context
			const { getI18n } = await import('@hub-client/i18n');
			const { t } = getI18n().global;

			// first user: message for video call start
			if (startsNewCall) {
				// create message for timeline to show the call has started
				const eventId = await pubhubs.addVideoCallMessage(
					currentRoom.roomId,
					VideocallStateType.Started,
					message ?? t('videocall.state.started'),
					undefined,
				);
				this.eventId = eventId;
			}

			// Don't block navigation/UX on this secondary message write.
			if (this.eventId) {
				void (async () => {
					try {
						const threadRoot = currentRoom.isDirectMessageRoom()
							? undefined
							: ((await pubhubs.getEvent(currentRoom.roomId, this.eventId!)) as TMessageEvent);
						await pubhubs.addVideoCallMessage(currentRoom.roomId, VideocallStateType.Joined, t('videocall.state.joined'), threadRoot);
					} catch {
						// Ignore best-effort "Joined" message failures.
					}
				})();
			}
			return true;
		},

		/** Whether another device than ours is currently in the current room's call. */
		async someoneElseInCall(): Promise<boolean> {
			const currentRoom = useRooms().currentRoom;
			if (!currentRoom) return false;

			const client = currentRoom.matrixRoom.client;
			const rtcSession = currentRoom.getMatrixRTCSession();
			await rtcSession.ensureRecalculateSessionMembers();
			return rtcSession.memberships.some((membership) => !(membership.userId === client.getUserId() && membership.deviceId === client.getDeviceId()));
		},

		/**
		 * For internal use. Use joinCall to join a call
		 * @returns
		 */
		async connectToCall(): Promise<boolean> {
			if (this.livekit_room) return true;
			if (this._connecting) return false;
			if (this.e2eeBlocked) {
				logger.warn('Not joining: this session cannot do end-to-end encrypted calls');
				return false;
			}
			this._connecting = true;

			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			const userId = currentRoom?.matrixRoom.client.getUserId();
			const deviceId = currentRoom?.matrixRoom.client.getDeviceId();
			if (!currentRoom || !userId || !deviceId) {
				this._connecting = false;
				return false;
			}

			try {
				const LiveKitTokenResponse = await currentRoom.getLiveKitTokenResponse();
				this.token = LiveKitTokenResponse[0];
				this.target_url = LiveKitTokenResponse[1];
				if (!this.token || !this.target_url) return false;

				// Call keys are only shared with devices the encryption layer knows; see trackCallMembers.
				await trackCallMembers(
					currentRoom.matrixRoom.client,
					currentRoom.matrixRoom.getJoinedMembers().map((member) => member.userId),
				);

				this.rtc_session = currentRoom.getMatrixRTCSession();

				this.rtc_session.joinRTCSession({ userId: userId, deviceId: deviceId, memberId: `${userId}:${deviceId}` }, [], undefined, {
					membershipEventExpiryMs: MembershipExpiryTime,
					manageMediaKeys: true,
				});
				this.addEndCallListener();

				const matrix_key_provider = new MatrixKeyProvider();
				// LiveKit hands the provider to its worker; it must not be a Vue proxy.
				this.matrix_key_provider = markRaw(matrix_key_provider);
				matrix_key_provider.setRTCSession(this.rtc_session as MatrixRTCSession);

				// The timeline may lag behind after creating/joining a call.
				// Never block the LiveKit connect flow on timeline availability.
				if (!this.eventId) {
					const lastVideoCallEvent = currentRoom.getLastVideoCallTimeLineEvent();
					if (lastVideoCallEvent?.event?.event_id) {
						this.eventId = lastVideoCallEvent.event.event_id;
					}
				}

				e2eeWorker = createE2EEWorker();
				const isFirefox = navigator.userAgent.includes('Firefox');
				const roomOptions: RoomOptions = {
					...defaultLiveKitOptions,
					// Firefox is less stable with VP9 + simulcast/dynacast in this setup.
					dynacast: isFirefox ? false : defaultLiveKitOptions.dynacast,
					publishDefaults: {
						...defaultLiveKitPublishOptions,
						simulcast: isFirefox ? false : defaultLiveKitPublishOptions.simulcast,
						videoCodec: isFirefox ? 'vp8' : 'vp9',
					},
					e2ee: { keyProvider: matrix_key_provider, worker: e2eeWorker },
				};

				this.livekit_room = new LiveKitRoom(roomOptions);
				await this.livekit_room.setE2EEEnabled(true);

				await this.livekit_room.connect(this.target_url, this.token, {
					autoSubscribe: true,
				});

				await this.applyOutputDevice();
				return true;
			} catch (error) {
				logger.error('Could not connect to the call', error);

				// cleanup
				if (this.livekit_room) {
					try {
						await this.livekit_room.disconnect(true);
					} catch {
						logger.debug('Cleanup after failed connect also failed', error);
					}
				}
				if (this.rtc_session) {
					try {
						await this.rtc_session.leaveRoomSession(10);
					} catch {
						logger.debug('Cleanup after failed connect also failed', error);
					}
				}
				e2eeWorker?.terminate();
				e2eeWorker = null;
				this.livekit_room = null;
				return false;
			} finally {
				this._connecting = false;
			}
		},

		async leaveCall() {
			if (this._leaving) return;
			if (!this.livekit_room) return;

			const rooms = useRooms();
			const pubhubs = usePubhubsStore();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return;

			this._leaving = true;
			try {
				// on demand getting single instance, because the store has no setup context
				const { getI18n } = await import('@hub-client/i18n');
				const { t } = getI18n().global;

				// Clean up eventlisteners
				if (endCallCleanup) {
					endCallCleanup();
					endCallCleanup = null;
				}

				const errors: unknown[] = [];

				// disconnect the livekit room
				try {
					const livekitRoom = this.livekit_room;
					this.livekit_room = null;

					// explicitly stop local participants tracks in livekit
					livekitRoom.localParticipant.audioTrackPublications.forEach((pub) => pub.track?.stop());
					livekitRoom.localParticipant.videoTrackPublications.forEach((pub) => pub.track?.stop());
					await livekitRoom.disconnect(true);
				} catch (error) {
					errors.push(error);
				}

				this.togglePublishTracks(false);
				this.undecryptable_participants = [];

				if (this.matrix_key_provider) {
					this.matrix_key_provider.removeAllListeners();
					this.matrix_key_provider = null;
				}

				e2eeWorker?.terminate();
				e2eeWorker = null;

				await this.changeAudioDevice(null);
				await this.changeVideoDevice(null);

				// send left-message
				if (this.eventId) {
					try {
						const threadRoot = currentRoom.isDirectMessageRoom()
							? undefined
							: ((await pubhubs.getEvent(currentRoom.roomId, this.eventId)) as TMessageEvent);
						await pubhubs.addVideoCallMessage(currentRoom.roomId, VideocallStateType.Left, t('videocall.state.left'), threadRoot);
					} catch (error) {
						errors.push(error);
					}
				}

				// leave rtc session
				// if necessary: send end message
				if (this.rtc_session && this.eventId) {
					try {
						const isLastMember = !(await this.someoneElseInCall()); // decided before leaving, see joinCall
						await this.rtc_session.leaveRoomSession(10);
						if (isLastMember && this.eventId) {
							if (currentRoom.isDirectMessageRoom()) {
								// DirectMessageRooms cannot have threads: edit original videcallmessage and add end message
								await pubhubs.addEndVideoCallMessage(
									currentRoom.roomId,
									VideocallStateType.StartedEnded,
									this.eventId,
									t('videocall.state.startedended'),
								);
								await pubhubs.addVideoCallMessage(currentRoom.roomId, VideocallStateType.Ended, t('videocall.state.ended'), undefined);
							} else {
								await pubhubs.addEndVideoCallMessage(currentRoom.roomId, VideocallStateType.Ended, this.eventId, t('videocall.state.ended'));
							}
						}
					} catch (error) {
						errors.push(error);
					}
					this.rtc_session = null;
				}

				this.eventId = null;
				this.token = null;
				this.target_url = null;

				this.audio_track = null;
				this.selected_audio_device_id = null;
				this.mute_audio_track = false;
				this.video_track = null;
				this.selected_video_device_id = null;
				this.mute_video_track = false;
				this.selected_output_device_id = null;
				this.screen_share = false;
				this.focus = [null, false];

				if (errors.length) {
					logger.error('LeaveCall failed: ', errors);
				}
			} finally {
				this._leaving = false;
			}
		},

		addEndCallListener() {
			const rooms = useRooms();
			if (!rooms.currentRoom) return;

			const rtcSession = rooms.currentRoom.getMatrixRTCSession();

			const onMembershipsChanged = async () => {
				if (!rooms.currentRoom) return;
				this.participant_count = rtcSession.memberships.length;
				if (rtcSession.memberships.length === 0) {
					const roomId = rooms.currentRoom.roomId;
					endCallCleanup?.();
					endCallCleanup = null;
					router.push({ name: 'room', params: { id: roomId } });
					try {
						await this.leaveCall();
					} catch (error) {
						logger.error('leavecall failed after membership change ', error);
					}
				}
			};

			rtcSession.on(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
			endCallCleanup = () => rtcSession.off(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
		},

		async toggleAudioTrack(should_publish: boolean) {
			this.should_publish_audio_track = should_publish;
			if (!this.livekit_room || !this.audio_track) {
				return;
			}

			if (this.should_publish_audio_track) {
				await this.livekit_room.localParticipant.publishTrack(this.audio_track as LocalAudioTrack);
			} else {
				await this.livekit_room.localParticipant.unpublishTrack(this.audio_track as LocalAudioTrack);
			}
		},

		async toggleVideoTrack(should_publish: boolean) {
			this.should_publish_video_track = should_publish;
			if (!this.livekit_room || !this.video_track) {
				return;
			}

			if (this.should_publish_video_track) {
				await this.livekit_room.localParticipant.publishTrack(this.video_track as LocalVideoTrack);
			} else {
				await this.livekit_room.localParticipant.unpublishTrack(this.video_track as LocalVideoTrack);
			}
		},

		isLocallyMuted(name: string): boolean {
			return this.locally_muted_participants.indexOf(name) > -1;
		},

		locallyMuteRemoteParticipant(name: string) {
			if (this.isLocallyMuted(name)) return;
			this.locally_muted_participants.push(name);

			const remoteParticipant = this.getRemoteParticipant(name);
			if (!remoteParticipant) return;

			const audioTrack = remoteParticipant?.getTrackPublication(Track.Source.Microphone);
			if (!audioTrack || !audioTrack.track) return;

			audioTrack.track.detach();
		},

		locallyUnmuteRemoteParticipant(name: string) {
			const index = this.locally_muted_participants.indexOf(name);
			if (index < 0) return;
			this.locally_muted_participants.splice(index, 1);

			const remoteParticipant = this.getRemoteParticipant(name);
			if (!remoteParticipant) return;

			const audioTrack = remoteParticipant?.getTrackPublication(Track.Source.Microphone);
			if (!audioTrack || !audioTrack.track) return;

			audioTrack.track.attach();
		},

		toggleLocalMute(name: string) {
			if (this.isLocallyMuted(name)) {
				this.locallyUnmuteRemoteParticipant(name);
			} else {
				this.locallyMuteRemoteParticipant(name);
			}
		},

		togglePublishTracks(should_publish: boolean) {
			this.toggleAudioTrack(should_publish);
			this.toggleVideoTrack(should_publish);
		},

		async toggleAudioTrackMute(should_mute: boolean) {
			this.mute_audio_track = should_mute;
			if (!this.audio_track) {
				return;
			}

			if (this.mute_audio_track) {
				await this.audio_track.mute();
			} else {
				await this.audio_track.unmute();
			}
		},

		async toggleVideoTrackMute(mute: boolean) {
			this.mute_video_track = mute;
			if (!this.video_track) {
				return;
			}

			if (this.mute_video_track) {
				await this.video_track.mute();
			} else {
				await this.video_track.unmute();
			}
		},

		/**
		 * @returns whether the screen share is now in the requested state. Starting one opens the
		 * browser's own picker, which rejects when the user dismisses it or the site is not allowed to
		 * capture the display at all.
		 */
		async toggleScreenShare(screenShare: boolean): Promise<boolean> {
			if (!this.livekit_room) return false;

			try {
				await this.livekit_room.localParticipant.setScreenShareEnabled(screenShare);
				this.screen_share = screenShare;
				return true;
			} catch (error) {
				logger.warn('Could not toggle screen sharing', error);
				this.screen_share = false;
				return false;
			}
		},

		toggleSelfView(selfView: boolean) {
			this.selfView = !selfView;
		},

		async changeVideoDevice(deviceId: string | null) {
			if (this.video_track) {
				this.video_track.stop();
			}

			this.selected_video_device_id = deviceId;

			if (deviceId) {
				this.video_track = await createLocalVideoTrack({
					facingMode: 'user',
					resolution: VideoPresets.h720,
					deviceId: deviceId,
				});

				if (this.mute_video_track) {
					await this.video_track.mute();
				}

				if (this.livekit_room && this.should_publish_video_track && this.video_track) {
					await this.livekit_room.localParticipant.publishTrack(this.video_track as LocalVideoTrack);
				}
			} else {
				this.video_track = null;
			}
		},

		async changeAudioDevice(deviceId: string | null) {
			if (this.audio_track) {
				this.audio_track.stop();
			}

			this.selected_audio_device_id = deviceId;

			if (deviceId) {
				this.audio_track = await createLocalAudioTrack({
					deviceId: deviceId,
					echoCancellation: true,
					noiseSuppression: true,
				});

				if (this.mute_audio_track) {
					await this.audio_track.mute();
				}

				if (this.livekit_room && this.should_publish_audio_track && this.audio_track) {
					await this.livekit_room.localParticipant.publishTrack(this.audio_track as LocalAudioTrack);
				}
			} else {
				this.audio_track = null;
			}
		},

		async changeOutputDevice(deviceId: string | null) {
			this.selected_output_device_id = deviceId;
			await this.applyOutputDevice();
		},

		/**
		 * Route remote audio to the selected speaker. Best effort: setSinkId is unsupported in
		 * Firefox, and there is nothing to route until a room is connected.
		 */
		async applyOutputDevice() {
			if (!this.livekit_room || !this.selected_output_device_id) return;

			try {
				await this.livekit_room.switchActiveDevice('audiooutput', this.selected_output_device_id);
			} catch (error) {
				logger.warn('Could not switch audio output device', error);
			}
		},

		setParticipantDecryptable(identity: string, decryptable: boolean) {
			const others = this.undecryptable_participants.filter((id) => id !== identity);
			this.undecryptable_participants = decryptable ? others : [...others, identity];
		},

		toggleFocus(participant: Participant | null, isScreenShare: boolean) {
			this.focus = [participant, isScreenShare];
		},
	},
});

export default useVideoCall;
