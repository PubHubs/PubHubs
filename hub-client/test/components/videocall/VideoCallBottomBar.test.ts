// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import type * as LivekitClient from 'livekit-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Components
import VideoCallBottomBar from '@hub-client/components/videocall/VideoCallBottomBar.vue';

// Composables
import { resetVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

import { routes } from '@hub-client/logic/core/router';

// Stores
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

async function mountBar() {
	Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve({ state: 'granted' }) } });
	Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) } });

	const i18n = setUpi18n();
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
	const videoCall = useVideoCall(pinia);
	videoCall.leaveCall = vi.fn().mockResolvedValue(undefined);

	const wrapper = mount(VideoCallBottomBar, {
		props: { currentRoom: { roomId: '!room:example.org' } as never, isFullscreen: false },
		global: { plugins: [pinia, createRouter({ history: createWebHistory(), routes }), i18n] },
	});
	await flushPromises();

	const button = (key: string) => {
		const found = wrapper.findAll('button').find((candidate) => candidate.attributes('title') === i18n.global.t(key));
		if (!found) throw new Error(`No button for ${key}`);
		return found;
	};

	return { button, i18n, videoCall, wrapper };
}

describe('VideoCallBottomBar.vue', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => resetVideoCallDevices());

	test('the settings button toggles the device row rather than opening a dialog', async () => {
		const { button, wrapper } = await mountBar();
		const pills = () => wrapper.findAll('[aria-haspopup="menu"]');

		expect(pills()).toHaveLength(0);

		await button('videocall.devices').trigger('click');
		await flushPromises();
		expect(pills()).toHaveLength(3);
		expect(wrapper.findAll('[role="dialog"]')).toHaveLength(0);

		await button('videocall.devices').trigger('click');
		await flushPromises();
		expect(pills()).toHaveLength(0);
	});

	test('a refused screen share explains itself and leaves the store untouched', async () => {
		const { button, i18n, videoCall, wrapper } = await mountBar();
		videoCall.toggleScreenShare = vi.fn().mockResolvedValue(false);

		await button('videocall.start_screen_share').trigger('click');
		await flushPromises();

		expect(wrapper.text()).toContain(i18n.global.t('videocall.permission_screenshare_title'));
		expect(videoCall.screen_share).toBe(false);
	});

	test('a successful screen share does not explain anything', async () => {
		const { button, i18n, videoCall, wrapper } = await mountBar();
		videoCall.toggleScreenShare = vi.fn().mockImplementation((on: boolean) => {
			videoCall.screen_share = on;
			return Promise.resolve(true);
		});

		await button('videocall.start_screen_share').trigger('click');
		await flushPromises();

		expect(wrapper.text()).not.toContain(i18n.global.t('videocall.permission_screenshare_title'));
		expect(button('videocall.stop_screen_share').exists()).toBe(true);
	});

	test('the microphone button reflects a mute carried over from the pre-join screen', async () => {
		const { button, videoCall } = await mountBar();
		videoCall.mute_audio_track = true;
		await flushPromises();

		expect(button('videocall.unmute_microphone').exists()).toBe(true);
	});
});
