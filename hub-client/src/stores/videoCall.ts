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
} from 'livekit-client';
import { type MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { defineStore } from 'pinia';

import { MatrixKeyProvider } from '@hub-client/logic/core/matrixKeyProvider';
import { router } from '@hub-client/logic/core/router';
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

			screen_share: false,

			locally_muted_participants: [] as string[],
			selfView: true,
			focus: [null, false] as [Participant | null, boolean],
			_connecting: false,
			_leaving: false,
		};
	},

	actions: {
		getRemoteParticipant(id: string): RemoteParticipant | undefined {
			return this.livekit_room?.remoteParticipants.get(id) as RemoteParticipant;
		},

		async startCall(message?: string): Promise<boolean> {
			const rooms = useRooms();
			const pubhubs = usePubhubsStore();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return false;

			// only start of the call, do not join yet
			try {
				await currentRoom.initializeCall();
			} catch (error) {
				logger.error('Initializing call failed ', error);
				return false;
			}

			// create message for timeline to show the call has started
			const eventId = await pubhubs.addVideoCallMessage(currentRoom.roomId, message ?? 'VideoCall Started');
			this.eventId = eventId;

			return true;
		},

		async joinCall(): Promise<boolean> {
			const rooms = useRooms();
			const pubhubs = usePubhubsStore();

			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return false;

			const connected = await this.connectToCall();
			if (!connected) return false;

			// Don't block navigation/UX on this secondary message write.
			if (this.eventId) {
				void (async () => {
					try {
						const threadRoot = (await pubhubs.getEvent(currentRoom.roomId, this.eventId!)) as TMessageEvent;
						await pubhubs.addMessage(currentRoom.roomId, 'Joined', threadRoot, undefined);
					} catch {
						// Ignore best-effort "Joined" message failures.
					}
				})();
			}
			return true;
		},

		/**
		 * For internal use. Use joinCall to join a call
		 * @returns
		 */
		async connectToCall(): Promise<boolean> {
			if (this.livekit_room) return true;
			if (this._connecting) return false;
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

				this.rtc_session = currentRoom.getMatrixRTCSession();

				this.rtc_session.joinRTCSession({ userId: userId, deviceId: deviceId, memberId: `${userId}:${deviceId}` }, [], undefined, {
					membershipEventExpiryMs: MembershipExpiryTime,
				});
				this.addEndCallListener();

				const matrix_key_provider = new MatrixKeyProvider();
				this.matrix_key_provider = matrix_key_provider;
				matrix_key_provider.setRTCSession(this.rtc_session as MatrixRTCSession);

				// The timeline may lag behind after creating/joining a call.
				// Never block the LiveKit connect flow on timeline availability.
				if (!this.eventId) {
					const lastVideoCallEvent = currentRoom.getLastVideoCallTimeLineEvent();
					if (lastVideoCallEvent?.event?.event_id) {
						this.eventId = lastVideoCallEvent.event.event_id;
					}
				}

				// E2EE is currently disabled. Don't pass e2ee options to the room —
				// having a worker/keyProvider configured but disabled corrupts remote video frames.
				// TODO: Re-enable E2EE when ready:
				// const e2ee = {
				// 	keyProvider: matrix_key_provider as BaseKeyProvider,
				// 	worker: new Worker(new URL('livekit-client/e2ee-worker', import.meta.url)),
				// };
				// this.options.e2ee = e2ee;

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
				};

				this.livekit_room = new LiveKitRoom(roomOptions);

				await this.livekit_room.connect(this.target_url, this.token, {
					autoSubscribe: true,
				});
				return true;
			} catch {
				if (this.livekit_room) {
					try {
						await this.livekit_room.disconnect(true);
					} catch {
						// best effort
					}
				}
				if (this.rtc_session) {
					try {
						await this.rtc_session.leaveRoomSession(10);
					} catch {
						//
					}
				}
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

				if (this.matrix_key_provider) {
					this.matrix_key_provider.removeAllListeners();
					this.matrix_key_provider = null;
				}

				if (this.options.e2ee) {
					// @ts-expect-error -- worker exists when e2ee options were created, but RoomOptions typing is broader
					this.options.e2ee.worker.terminate();
					this.options.e2ee = undefined;
				}

				await this.changeAudioDevice(null);
				await this.changeVideoDevice(null);

				// send left-message
				if (this.eventId) {
					try {
						const threadRoot = (await pubhubs.getEvent(currentRoom.roomId, this.eventId)) as TMessageEvent;
						await pubhubs.addThreadMessageWithoutLocalEcho(currentRoom.roomId, 'Left', threadRoot);
					} catch (error) {
						errors.push(error);
					}
				}

				// leave rtc session
				// if necessary: send end message
				if (this.rtc_session) {
					try {
						const isLastMember = this.rtc_session.memberships.length === 1; // check if you are the last participant before leaving, it takes some time for the memberships to sync
						await this.rtc_session.leaveRoomSession(10);
						if (isLastMember && this.eventId) {
							await pubhubs.addEndVideoCallMessage(currentRoom.roomId, this.eventId, 'Ended');
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
				this.video_track = null;
				this.selected_video_device_id = null;
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

			const onMembershipsChanged = () => {
				if (!rooms.currentRoom) return;
				if (rtcSession.memberships.length === 0) {
					endCallCleanup?.();
					endCallCleanup = null;
					router.push({ name: 'room', params: { id: rooms.currentRoom.roomId } });
					this.leaveCall();
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
			if (!this.livekit_room || !this.audio_track) {
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
			if (!this.livekit_room || !this.video_track) {
				return;
			}

			if (this.mute_video_track) {
				await this.video_track.mute();
			} else {
				await this.video_track.unmute();
			}
		},

		async toggleScreenShare(screenShare: boolean) {
			this.screen_share = screenShare;
			if (!this.livekit_room) return;

			await this.livekit_room.localParticipant.setScreenShareEnabled(this.screen_share);
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

				if (this.livekit_room && this.should_publish_audio_track && this.audio_track) {
					await this.livekit_room.localParticipant.publishTrack(this.audio_track as LocalAudioTrack);
				}
			} else {
				this.audio_track = null;
			}
		},

		toggleFocus(participant: Participant | null, isScreenShare: boolean) {
			this.focus = [participant, isScreenShare];
		},
	},
});

export default useVideoCall;
