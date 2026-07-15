// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import type * as LivekitClient from 'livekit-client';
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

function makeRemoteParticipants(count: number) {
	const map = new Map();
	for (let i = 0; i < count; i++) {
		map.set(`@participant${i}:example.org`, {});
	}
	return map;
}

function makeFakeLivekitRoom(remoteParticipantsCount: number) {
	return {
		remoteParticipants: makeRemoteParticipants(remoteParticipantsCount),
		removeAllListeners: vi.fn(),
		on: vi.fn(),
	};
}

async function mountVideoCallPage(remoteParticipantsCount: number) {
	const router = createRouter({ history: createWebHistory(), routes });
	router.push = vi.fn().mockResolvedValue(undefined);

	const i18n = setUpi18n();
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

	const rooms = useRooms(pinia);
	// goBack() only reads currentRoom.value.roomId - a minimal stand-in is enough here.
	rooms.rooms[ROOM_ID] = { roomId: ROOM_ID } as unknown as ReturnType<typeof useRooms>['rooms'][string];
	rooms.currentRoomId = ROOM_ID;

	const videoCall = useVideoCall(pinia);
	videoCall.livekit_room = makeFakeLivekitRoom(remoteParticipantsCount) as unknown as typeof videoCall.livekit_room;
	videoCall.endCall = vi.fn().mockResolvedValue(undefined);
	videoCall.leaveCall = vi.fn().mockResolvedValue(undefined);

	const wrapper = mount(VideoCallPage, {
		global: {
			plugins: [pinia, router, i18n],
			// VideoCallPreview constructs a real AudioContext, which jsdom doesn't provide.
			stubs: { VideoCallPreview: true },
		},
	});
	await flushPromises();

	return { wrapper, videoCall };
}

function clickExit(wrapper: Awaited<ReturnType<typeof mountVideoCallPage>>['wrapper']) {
	const exitButton = wrapper.findAll('button').find((button) => button.text() === 'Exit');
	if (!exitButton) throw new Error('Exit button not found');
	return exitButton.trigger('click');
}

describe('VideoCallPage.vue - Exit button', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('alone in the call: Exit must terminate the call, not just leave it dangling', async () => {
		const { wrapper, videoCall } = await mountVideoCallPage(0);

		await clickExit(wrapper);
		await flushPromises();

		expect(videoCall.endCall).toHaveBeenCalledTimes(1);
		expect(videoCall.leaveCall).not.toHaveBeenCalled();
	});

	test('others still present: Exit must only leave, not end the call for everyone', async () => {
		const { wrapper, videoCall } = await mountVideoCallPage(1);

		await clickExit(wrapper);
		await flushPromises();

		expect(videoCall.leaveCall).toHaveBeenCalledTimes(1);
		expect(videoCall.endCall).not.toHaveBeenCalled();
	});

});
