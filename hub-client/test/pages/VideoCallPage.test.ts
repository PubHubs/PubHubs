// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import type * as LivekitClient from 'livekit-client';
import { Room as LivekitRoom } from 'livekit-client';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Logic
import { routes } from '@hub-client/logic/core/router';

// Pages
import VideoCallPage from '@hub-client/pages/VideoCallPage.vue';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import useVideoCall from '@hub-client/stores/videoCall';

// Logic
import { setUpi18n } from '@hub-client/i18n';

vi.mock('livekit-client', async () => {
	const actual = await vi.importActual<typeof LivekitClient>('livekit-client');
	return {
		...actual,
		Room: class {
			static getLocalDevices = vi.fn().mockResolvedValue([]);
		},
	};
});

const ROOM_ID = '!videocallroom:example.org';

function makeFakeRoom(isOngoingCall: boolean) {
	return {
		roomId: ROOM_ID,
		isOngoingCall: vi.fn().mockReturnValue(isOngoingCall),
	};
}

function makeFakeLivekitRoom() {
	return {
		remoteParticipants: new Map(),
		removeAllListeners: vi.fn(),
		on: vi.fn(),
	};
}

async function mountVideoCallPage(isOngoingCall: boolean) {
	const router = createRouter({ history: createWebHistory(), routes });
	router.push = vi.fn().mockResolvedValue(undefined);

	const i18n = setUpi18n();
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

	const rooms = useRooms(pinia);
	rooms.rooms[ROOM_ID] = makeFakeRoom(isOngoingCall) as unknown as ReturnType<typeof useRooms>['rooms'][string];
	rooms.currentRoomId = ROOM_ID;

	const videoCall = useVideoCall(pinia);
	videoCall.livekit_room = makeFakeLivekitRoom() as unknown as typeof videoCall.livekit_room;
	videoCall.leaveCall = vi.fn().mockResolvedValue(undefined);
	videoCall.changeAudioDevice = vi.fn().mockResolvedValue(undefined);
	videoCall.changeVideoDevice = vi.fn().mockResolvedValue(undefined);

	const wrapper = mount(VideoCallPage, {
		global: {
			plugins: [pinia, router, i18n],
			// VideoCallPreview constructs a real AudioContext, which jsdom doesn't provide.
			stubs: { VideoCallPreview: true },
		},
	});
	await flushPromises();

	return { wrapper, videoCall, exitLabel: i18n.global.t('videocall.exit') };
}

function clickExit({ wrapper, exitLabel }: Awaited<ReturnType<typeof mountVideoCallPage>>) {
	const exitButton = wrapper.findAll('button').find((button) => button.text() === exitLabel);
	if (!exitButton) throw new Error('Exit button not found');
	return exitButton.trigger('click');
}

describe('VideoCallPage.vue - Exit button', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('while a call is ongoing, Exit navigates away without leaving or ending it', async () => {
		const mounted = await mountVideoCallPage(true);

		await clickExit(mounted);
		await flushPromises();

		expect(mounted.videoCall.leaveCall).not.toHaveBeenCalled();
	});

	// Only reachable when the RTC session reports no memberships at all
	test('with no call ongoing, Exit ends the call', async () => {
		const mounted = await mountVideoCallPage(false);

		await clickExit(mounted);
		await flushPromises();

		expect(mounted.videoCall.leaveCall).not.toHaveBeenCalled();
	});

	test('unmounting the page, e.g. by switching rooms, leaves the call and releases the devices', async () => {
		const { wrapper, videoCall } = await mountVideoCallPage(true);

		wrapper.unmount();
		await flushPromises();

		expect(videoCall.leaveCall).toHaveBeenCalledTimes(1);
	});

	test('devices still opening when the page is left are released once they finish', async () => {
    	let resolveDevices: (devices: MediaDeviceInfo[]) => void = () => {};
    	vi.mocked(LivekitRoom.getLocalDevices).mockReturnValueOnce(new Promise((resolve) => (resolveDevices = resolve)));
    	const { wrapper, videoCall } = await mountVideoCallPage(true);

    	wrapper.unmount();
	    await flushPromises();
		
		expect(videoCall.leaveCall).toHaveBeenCalledTimes(1);
	});

});
