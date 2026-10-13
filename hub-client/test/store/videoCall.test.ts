// Packages
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

function fakeTrack() {
	return { mute: vi.fn(), unmute: vi.fn(), stop: vi.fn() };
}

describe('videoCall store', () => {
	beforeEach(() => {
		setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));
		vi.clearAllMocks();
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
});
