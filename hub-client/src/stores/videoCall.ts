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
import { type MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { defineStore } from 'pinia';

import { MatrixKeyProvider } from '@hub-client/logic/core/matrixKeyProvider';

import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

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

const useVideoCall = defineStore('videoCall', {
	state: () => {
		return {
			call_active: false,
			token: null as string | null,
			target_url: null as string | null,
			should_publish_audio_track: false,
			should_publish_video_track: false,
			rtc_session: null as MatrixRTCSession | null,
			groupCall: null as GroupCall | null,
			pubhubsStore: usePubhubsStore(),

			eventId: null as string | null,

			matrix_key_provider: null as MatrixKeyProvider | null,
			livekit_room: null as LiveKitRoom | null,
			options: { ...defaultLiveKitOptions } as RoomOptions,

			audio_track: null as LocalAudioTrack | null,
			audio_devices: [] as MediaDeviceInfo[],
			selected_audio_device_id: null as string | null,
			mute_audio_track: false,
			video_track: null as LocalVideoTrack | null,
			video_devices: [] as MediaDeviceInfo[],
			selected_video_device_id: null as string | null,
			mute_video_track: false,

			screen_share_track: null as LocalVideoTrack | null,
			screen_share: false,

			locally_muted_participants: [] as string[],
			selfView: true,
			focus: [null, false] as [Participant | null, boolean],
			_isEnding: false, // Flag to prevent listener race during endCall
		};
	},

	actions: {
		getRemoteParticipant(id: string): RemoteParticipant | undefined {
			return this.livekit_room?.remoteParticipants.get(id) as RemoteParticipant;
		},

		async startCall() {
			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return;

			const eventId = await this.pubhubsStore.addVideoCallMessage(currentRoom.roomId, 'VideoCall Started');
			this.eventId = eventId;

			this.groupCall = await currentRoom.createGroupCall();

			currentRoom.startMatrixRTC();

			await this.connectToCall();
		},

		async joinCall() {
			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return;

			this.groupCall = currentRoom.getGroupCall();
			if (!this.groupCall) return;

			await this.connectToCall();

			if (!this.eventId) return;

			const threadRoot = (await this.pubhubsStore.getEvent(currentRoom.roomId, this.eventId)) as TMessageEvent;
			await this.pubhubsStore.addMessage(currentRoom.roomId, 'Joined', threadRoot, undefined);
		},

		async connectToCall() {
			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return;

			const LiveKitTokenResponse = await currentRoom.getLiveKitTokenResponse();
			this.token = LiveKitTokenResponse[0];
			this.target_url = LiveKitTokenResponse[1];

			this.call_active = true;
			this.rtc_session = currentRoom.getMatrixRTCSessions();
			this.rtc_session.joinRoomSession([]);
			this.pubhubsStore.addEndCallListener();

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
		},

		async leaveCall() {
			if (this.call_active) {
				this.call_active = false;
			} else {
				return;
			}

			if (this.livekit_room) {
				await this.livekit_room.disconnect(true);
				await this.togglePublishTracks(false);
				this.livekit_room = null;
			}

			if (this.matrix_key_provider) {
				this.matrix_key_provider.removeAllListeners();
				this.matrix_key_provider = null;
			}

			if (this.options.e2ee) {
				// @ts-expect-error -- worker exists when e2ee options were created, but RoomOptions typing is broader
				this.options.e2ee.worker.terminate();
				this.options.e2ee = undefined;
			}

			if (this.groupCall) {
				this.groupCall.leave();
				this.groupCall = null;
			}

			await this.changeAudioDevice(null);
			await this.changeVideoDevice(null);

			if (this.rtc_session) {
				await this.rtc_session.leaveRoomSession(10);
				this.rtc_session = null;
			}

			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (currentRoom && this.eventId) {
				const threadRoot = (await this.pubhubsStore.getEvent(currentRoom.roomId, this.eventId)) as TMessageEvent;
				await this.pubhubsStore.addMessage(currentRoom.roomId, 'Left', threadRoot, undefined);
			}

			this.eventId = null;
			this.token = null;
			this.target_url = null;

			this.audio_track = null;
			this.selected_audio_device_id = null;
			this.video_track = null;
			this.selected_video_device_id = null;
			this.screen_share_track = null;
			this.focus = [null, false];
		},

		async endCall() {
			const rooms = useRooms();
			const currentRoom = rooms.currentRoom;
			if (!currentRoom) return;

			// Set flag so the addEndCallListener knows not to fire (we handle cleanup ourselves)
			this._isEnding = true;

			if (this.eventId) {
				await this.pubhubsStore.updateVideoCallMessage(currentRoom.roomId, this.eventId, 'VideoCall Ended');
			}

			// Save reference before leaveCall() clears this.groupCall
			const groupCallToTerminate = this.groupCall;

			// Leave first so cleanup completes before terminate fires any listeners
			await this.leaveCall();

			// Terminate the group call so a new one can be created later
			if (groupCallToTerminate) {
				await groupCallToTerminate.terminate(true);
			}
			currentRoom.setCurrentThreadId(undefined);

			this._isEnding = false;
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

		async togglePublishTracks(should_publish: boolean) {
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

				if (this.call_active && this.should_publish_video_track && this.livekit_room && this.video_track) {
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

				if (this.call_active && this.should_publish_audio_track && this.livekit_room && this.audio_track) {
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
