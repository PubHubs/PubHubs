// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

// Components
import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

// Logic
import { setUpi18n } from '@hub-client/i18n';

const IDENTITY = '@b:hub:DEV2';

async function mountTile({ undecryptable }: { undecryptable: string[] }) {
	const i18n = setUpi18n();
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
	useVideoCall(pinia).undecryptable_participants = undecryptable;
	const participant = {
		identity: IDENTITY,
		isCameraEnabled: true,
		isMicrophoneEnabled: true,
		isSpeaking: false,
		on: vi.fn(),
		getTrackPublication: () => undefined,
	};

	const wrapper = mount(VideoCallVideo, {
		props: { username: IDENTITY, participant: participant as never, size: '', isSelfView: false },
		global: { plugins: [pinia, i18n], stubs: { UserDisplayName: true } },
	});
	await flushPromises();
	return { i18n, wrapper };
}

describe('VideoCallVideo.vue', () => {
	test('says the video cannot be decrypted instead of showing broken frames', async () => {
		const { i18n, wrapper } = await mountTile({ undecryptable: [IDENTITY] });

		expect(wrapper.text()).toContain(i18n.global.t('videocall.undecryptable'));
	});

	test('shows no such notice for a participant whose media decrypts', async () => {
		const { i18n, wrapper } = await mountTile({ undecryptable: ['@someone:hub:ELSE'] });

		expect(wrapper.text()).not.toContain(i18n.global.t('videocall.undecryptable'));
	});
});
