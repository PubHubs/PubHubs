// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

// Components
import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

// Models
import { type TDecryptionState } from '@hub-client/models/videocall/TVideoCall';

// Logic
import { setUpi18n } from '@hub-client/i18n';

const IDENTITY = '@b:hub:DEV2';

 async function mountTile(decryptionStates: Record<string, TDecryptionState>) {
          const i18n = setUpi18n();
          const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
          useVideoCall(pinia).decryption_states = decryptionStates;
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
          test('says the connection is being secured while decryption is pending', async () => {
                  const { i18n, wrapper } = await mountTile({ [IDENTITY]: 'pending' });

                  expect(wrapper.text()).toContain(i18n.global.t('videocall.decryption_pending'));
          });

          test('says the video cannot be decrypted instead of showing broken frames', async () => {
                  const { i18n, wrapper } = await mountTile({ [IDENTITY]: 'failed' });

                  expect(wrapper.text()).toContain(i18n.global.t('videocall.undecryptable'));
          });

          test('shows no notice for a participant whose media decrypts', async () => {
                  const { i18n, wrapper } = await mountTile({ '@someone:hub:ELSE': 'failed' });

                  expect(wrapper.text()).not.toContain(i18n.global.t('videocall.undecryptable'));
                  expect(wrapper.text()).not.toContain(i18n.global.t('videocall.decryption_pending'));
          });
  });

