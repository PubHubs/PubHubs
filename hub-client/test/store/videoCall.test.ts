// Packages
import { createTestingPinia } from '@pinia/testing';
import type * as LivekitClient from 'livekit-client';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';
import useVideoCall from '@hub-client/stores/videoCall';

// Logic
import { setUpi18n } from '@hub-client/i18n';
import { VideocallStateType } from '@hub-client/logic/core/events';

const livekit = vi.hoisted(() => ({
	rooms: [] as Array<{ options: unknown; setE2EEEnabled: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }>,
	supported: true,
	remoteIdentities: [] as string[], // who else is connected to the Livekit room when we connect
}));

vi.mock('livekit-client', async () => {
	const actual = await vi.importActual<typeof LivekitClient>('livekit-client');
	class FakeRoom {
		options: unknown;
		setE2EEEnabled = vi.fn().mockResolvedValue(undefined);
		connect = vi.fn().mockResolvedValue(undefined);
		disconnect = vi.fn().mockResolvedValue(undefined);
		switchActiveDevice = vi.fn();
		on = vi.fn();
		off = vi.fn();
		remoteParticipants = new Map(livekit.remoteIdentities.map((identity) => [identity, { identity }]));
		constructor(options: unknown) {
			this.options = options;
			livekit.rooms.push(this);
		}
	}
	return { ...actual, Room: FakeRoom, isE2EESupported: () => livekit.supported };
});

vi.mock('@hub-client/logic/core/e2eeWorker', () => ({ createE2EEWorker: () => ({ terminate: vi.fn() }) }));

const trackCallMembers = vi.hoisted(() => vi.fn());
vi.mock('@hub-client/logic/core/trackCallMembers', () => ({ trackCallMembers }));

function fakeRtcSession(memberships: Array<{ userId: string; deviceId: string }> = []) {
	return {
		joinRTCSession: vi.fn(),
		leaveRoomSession: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		reemitEncryptionKeys: vi.fn(),
		ensureRecalculateSessionMembers: vi.fn().mockResolvedValue(undefined),
		memberships,
	};
}

function enterCallRoom({ e2eeAvailable = true, memberships = [] as Array<{ userId: string; deviceId: string }>, isDirectMessageRoom = false } = {}) {
	const rtcSession = fakeRtcSession(memberships);
	(useRooms() as unknown as { currentRoom: unknown }).currentRoom = {
		roomId: '!room:hub',
		matrixRoom: {
			client: { getUserId: () => '@a:hub', getDeviceId: () => 'DEV1' },
			getJoinedMembers: () => [{ userId: '@a:hub' }, { userId: '@b:hub' }],
		},
		getLiveKitTokenResponse: vi.fn().mockResolvedValue(['livekit-token', 'wss://livekit.hub']),
		getMatrixRTCSession: () => rtcSession,
		getLastVideoCallTimeLineEvent: () => undefined,
		isDirectMessageRoom: () => isDirectMessageRoom,
	};
	usePubhubsStore().e2eeAvailable = e2eeAvailable;
	return { rtcSession };
}

function fakeTrack() {
	return { mute: vi.fn(), unmute: vi.fn(), stop: vi.fn() };
}

describe('videoCall store', () => {
	beforeEach(() => {
		setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));
		vi.clearAllMocks();
		livekit.rooms.length = 0;
		livekit.supported = true;
		livekit.remoteIdentities = [];
	});

	describe('toggleScreenShare', () => {
		test('records the new state when the browser hands over a screen', async () => {
			const videoCall = useVideoCall();
			const setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);
			videoCall.livekit_room = { localParticipant: { setScreenShareEnabled } } as never;

			await expect(videoCall.toggleScreenShare(true)).resolves.toBe(true);
			expect(videoCall.screen_share).toBe(true);
		});

		test('stays off when the display picker is dismissed', async () => {
			const videoCall = useVideoCall();
			const setScreenShareEnabled = vi.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
			videoCall.livekit_room = { localParticipant: { setScreenShareEnabled } } as never;

			await expect(videoCall.toggleScreenShare(true)).resolves.toBe(false);
			expect(videoCall.screen_share).toBe(false);
		});
	});

	describe('mute toggles', () => {
		test('mute the local track without a room, as the pre-join screen does', async () => {
			const videoCall = useVideoCall();
			const track = fakeTrack();
			videoCall.audio_track = track as never;

			await videoCall.toggleAudioTrackMute(true);

			expect(videoCall.mute_audio_track).toBe(true);
			expect(track.mute).toHaveBeenCalled();
		});

		test('record the intent even when there is no track yet', async () => {
			const videoCall = useVideoCall();

			await videoCall.toggleVideoTrackMute(true);

			expect(videoCall.mute_video_track).toBe(true);
		});
	});

	describe('changeOutputDevice', () => {
		test('routes remote audio once a room is connected', async () => {
			const videoCall = useVideoCall();
			const switchActiveDevice = vi.fn().mockResolvedValue(undefined);
			videoCall.livekit_room = { switchActiveDevice } as never;

			await videoCall.changeOutputDevice('speaker-1');

			expect(videoCall.selected_output_device_id).toBe('speaker-1');
			expect(switchActiveDevice).toHaveBeenCalledWith('audiooutput', 'speaker-1');
		});

		test('remembers the choice before there is anything to route', async () => {
			const videoCall = useVideoCall();

			await videoCall.changeOutputDevice('speaker-1');

			expect(videoCall.selected_output_device_id).toBe('speaker-1');
		});

		test('survives a browser that cannot switch outputs', async () => {
			const videoCall = useVideoCall();
			videoCall.livekit_room = { switchActiveDevice: vi.fn().mockRejectedValue(new Error('setSinkId unsupported')) } as never;

			await expect(videoCall.changeOutputDevice('speaker-1')).resolves.toBeUndefined();
			expect(videoCall.selected_output_device_id).toBe('speaker-1');
		});
	});

	describe('end-to-end encryption', () => {
		test('asks matrix-js-sdk to create and share media keys', async () => {
			const { rtcSession } = enterCallRoom();

			await useVideoCall().connectToCall();

			expect(rtcSession.joinRTCSession.mock.calls[0][3]).toMatchObject({ manageMediaKeys: true });
		});

		test("fetches the room members' devices before joining, so call keys can reach them", async () => {
			const { rtcSession } = enterCallRoom();
			trackCallMembers.mockResolvedValue(undefined);

			await useVideoCall().connectToCall();

			expect(trackCallMembers).toHaveBeenCalledWith(expect.anything(), ['@a:hub', '@b:hub']);
			expect(trackCallMembers.mock.invocationCallOrder[0]).toBeLessThan(rtcSession.joinRTCSession.mock.invocationCallOrder[0]);
		});

		test('creates the LiveKit room with E2EE and enables it before connecting', async () => {
			enterCallRoom();

			await expect(useVideoCall().connectToCall()).resolves.toBe(true);

			const [room] = livekit.rooms;
			expect(room.options).toMatchObject({ e2ee: { keyProvider: expect.anything(), worker: expect.anything() } });
			expect(room.setE2EEEnabled).toHaveBeenCalledWith(true);
			expect(room.setE2EEEnabled.mock.invocationCallOrder[0]).toBeLessThan(room.connect.mock.invocationCallOrder[0]);
		});

		test('refuses to join when this session has no encryption', async () => {
			const { rtcSession } = enterCallRoom({ e2eeAvailable: false });
			const videoCall = useVideoCall();

			expect(videoCall.e2eeBlocked).toBe(true);
			await expect(videoCall.connectToCall()).resolves.toBe(false);
			expect(rtcSession.joinRTCSession).not.toHaveBeenCalled();
			expect(livekit.rooms).toHaveLength(0);
		});

		test('refuses to join in a browser without LiveKit E2EE support', async () => {
			enterCallRoom();
			livekit.supported = false;

			await expect(useVideoCall().connectToCall()).resolves.toBe(false);
			expect(livekit.rooms).toHaveLength(0);
		});
	});

	describe('joinCall "call started" message', () => {
		function stubMessages() {
			setUpi18n();
			const pubhubs = usePubhubsStore();
			const addVideoCallMessage = vi.fn().mockResolvedValue('$start');
			Object.assign(pubhubs, { addVideoCallMessage, getEvent: vi.fn().mockResolvedValue({}), addMessage: vi.fn().mockResolvedValue(undefined) });
			return { addVideoCallMessage };
		}
		
		test('starts a new call when nobody else is connected', async () => {
				enterCallRoom();
				const { addVideoCallMessage } = stubMessages();
				await useVideoCall().joinCall();
				const startedCalls = addVideoCallMessage.mock.calls.filter(([, state]) => state === VideocallStateType.Started);
				expect(startedCalls).toHaveLength(1);
		});

		test('ignores a leftover Matrix membership when nobody is connected to LiveKit', async () => {
				enterCallRoom({ memberships: [{ userId: '@b:hub', deviceId: 'DEV2' }] });
				const { addVideoCallMessage } = stubMessages();
				await useVideoCall().joinCall();
				const startedCalls = addVideoCallMessage.mock.calls.filter(([, state]) => state === VideocallStateType.Started);
				expect(startedCalls).toHaveLength(1);
		});

		test('joins the ongoing call, without announcing a new one, when someone else is connected', async () => {
				livekit.remoteIdentities = ['@b:hub:DEV2'];
				enterCallRoom();
				const { addVideoCallMessage } = stubMessages();
				await useVideoCall().joinCall();
				expect(addVideoCallMessage).not.toHaveBeenCalled();
		});
	});

	describe('leaveCall "call ended" message', () => {
		function inCall(remoteIdentities: string[], { isDirectMessageRoom = false } = {}) {
        	setUpi18n();
        	const { rtcSession } = enterCallRoom({ isDirectMessageRoom });
        	const videoCall = useVideoCall();
			videoCall.livekit_room = {
				localParticipant: { audioTrackPublications: new Map(), videoTrackPublications: new Map() },
            	remoteParticipants: new Map(remoteIdentities.map((identity) => [identity, { identity }])),
	        	disconnect: vi.fn().mockResolvedValue(undefined),
         	} as never;
			videoCall.rtc_session = rtcSession as never;
			videoCall.eventId = '$start';
			videoCall.changeAudioDevice = vi.fn().mockResolvedValue(undefined);
			videoCall.changeVideoDevice = vi.fn().mockResolvedValue(undefined);
			const addEndVideoCallMessage = vi.fn().mockResolvedValue(undefined);
			const addVideoCallMessage = vi.fn().mockResolvedValue(undefined);
			Object.assign(usePubhubsStore(), {
				addEndVideoCallMessage,
				addVideoCallMessage,
				getEvent: vi.fn().mockResolvedValue({}),
			});
			return { videoCall, addEndVideoCallMessage, addVideoCallMessage };
		}

		test('ends the call when nobody else is connected', async () => {
			const { videoCall, addEndVideoCallMessage } = inCall([]);

			await videoCall.leaveCall();

			expect(addEndVideoCallMessage).toHaveBeenCalledOnce();
		});

		test('keeps the call going for the others when someone else is still in it', async () => {
			const { videoCall, addEndVideoCallMessage } = inCall(['@b:hub:DEV2']);

			await videoCall.leaveCall();

			expect(addEndVideoCallMessage).not.toHaveBeenCalled();
		});

		test('in a direct message room, marks the original call message as ended and posts the end in the timeline', async () => {
			const { videoCall, addEndVideoCallMessage, addVideoCallMessage } = inCall([], { isDirectMessageRoom: true });

			await videoCall.leaveCall();

			expect(addEndVideoCallMessage).toHaveBeenCalledExactlyOnceWith('!room:hub', VideocallStateType.StartedEnded, '$start', expect.any(String));
			expect(addVideoCallMessage).toHaveBeenCalledWith('!room:hub', VideocallStateType.Ended, expect.any(String), undefined);
			expect(usePubhubsStore().getEvent).not.toHaveBeenCalled();
		});
	});

	describe('setParticipantDecryptable', () => {
		test('tracks participants whose media cannot be decrypted, once each', () => {
			const videoCall = useVideoCall();

			videoCall.setParticipantDecryptable('@b:hub:DEV2', false);
			videoCall.setParticipantDecryptable('@b:hub:DEV2', false);
			expect(videoCall.undecryptable_participants).toEqual(['@b:hub:DEV2']);

			videoCall.setParticipantDecryptable('@b:hub:DEV2', true);
			expect(videoCall.undecryptable_participants).toEqual([]);
		});
	});
});
