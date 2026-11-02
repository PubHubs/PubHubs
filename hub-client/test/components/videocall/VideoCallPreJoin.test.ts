// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import type * as LivekitClient from 'livekit-client';
import { afterEach, describe, expect, test, vi } from 'vitest';

// Components
import VideoCallPreJoin from '@hub-client/components/videocall/VideoCallPreJoin.vue';

// Composables
import { resetVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

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

async function mountPreJoin({ blocked }: { blocked: boolean }) {
	Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => Promise.resolve({ state: 'granted' }) } });
	Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) } });

	const i18n = setUpi18n();
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
	(useVideoCall(pinia) as unknown as { e2eeBlocked: boolean }).e2eeBlocked = blocked;

	const wrapper = mount(VideoCallPreJoin, {
		global: {
			plugins: [pinia, i18n],
			stubs: { VideoCallPreview: true, VideoCallDevicePicker: true, VideoCallPermissionDialog: true },
		},
	});
	await flushPromises();

	const joinButton = wrapper.findAll('button').find((button) => button.text() === i18n.global.t('videocall.join'));
	if (!joinButton) throw new Error('Join button not found');
	return { i18n, joinButton, wrapper };
}

describe('VideoCallPreJoin.vue', () => {
	afterEach(() => resetVideoCallDevices());

	test('explains why and disables joining when this session cannot do encrypted calls', async () => {
		const { i18n, joinButton, wrapper } = await mountPreJoin({ blocked: true });

		expect(wrapper.text()).toContain(i18n.global.t('videocall.e2ee_blocked_title'));
		expect(joinButton.attributes('disabled')).toBeDefined();
	});

	test('shows no block message and allows joining when encryption works', async () => {
		const { i18n, joinButton, wrapper } = await mountPreJoin({ blocked: false });

		expect(wrapper.text()).not.toContain(i18n.global.t('videocall.e2ee_blocked_title'));
		expect(joinButton.attributes('disabled')).toBeUndefined();
	});
});
