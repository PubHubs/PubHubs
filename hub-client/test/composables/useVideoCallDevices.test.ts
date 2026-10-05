// Packages
import { createTestingPinia } from '@pinia/testing';
import type * as LivekitClient from 'livekit-client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';

// Composables
import { resetVideoCallDevices, useVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

const getLocalDevices = vi.fn();

vi.mock('livekit-client', async () => {
	const actual = await vi.importActual<typeof LivekitClient>('livekit-client');
	return {
		...actual,
		Room: class {
			static getLocalDevices = (kind: string) => getLocalDevices(kind) as Promise<MediaDeviceInfo[]>;
		},
	};
});

function device(deviceId: string, label: string) {
	return { deviceId, label } as MediaDeviceInfo;
}

function stubBrowser({ permission, getUserMedia }: { permission?: string; getUserMedia: () => Promise<MediaStream> }) {
	Object.defineProperty(navigator, 'permissions', {
		configurable: true,
		value: { query: () => (permission ? Promise.resolve({ state: permission }) : Promise.reject(new Error('unsupported'))) },
	});
	Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
}

const grant = () => Promise.resolve({ getTracks: () => [] } as unknown as MediaStream);
const refuse = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
const missing = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotFoundError' }));

function setUpStore() {
	const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
	return useVideoCall(pinia);
}

describe('useVideoCallDevices', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		getLocalDevices.mockImplementation((kind: string) => Promise.resolve([device(`${kind}-1`, `First ${kind}`)]));
	});

	afterEach(() => {
		resetVideoCallDevices();
		vi.useRealTimers();
	});

	test('selects a default for each kind when the store has none', async () => {
		const videoCall = setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.access.value).toBe('granted');
		expect(devices.devicesLoaded.value).toBe(true);
		expect(videoCall.changeAudioDevice).toHaveBeenCalledWith('audioinput-1');
		expect(videoCall.changeOutputDevice).toHaveBeenCalledWith('audiooutput-1');
		expect(videoCall.changeVideoDevice).toHaveBeenCalledWith('videoinput-1');
	});

	test('prefers the device the platform calls "default"', async () => {
		const videoCall = setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });
		getLocalDevices.mockImplementation(() => Promise.resolve([device('other', 'Other'), device('default', 'System default')]));

		await useVideoCallDevices().setUpDevices();

		expect(videoCall.changeAudioDevice).toHaveBeenCalledWith('default');
	});

	test('keeps a selection the store already holds', async () => {
		const videoCall = setUpStore();
		videoCall.selected_audio_device_id = 'audioinput-1';
		stubBrowser({ permission: 'granted', getUserMedia: grant });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(videoCall.changeAudioDevice).not.toHaveBeenCalled();
		expect(devices.audioDevice.value).toEqual({ label: 'First audioinput', value: 'audioinput-1' });
	});

	test('drops the unlabelled placeholders returned before access is granted', async () => {
		setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });
		getLocalDevices.mockImplementation(() => Promise.resolve([device('', ''), device('real', 'Real device')]));

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.audioOptions.value).toEqual([{ label: 'Real device', value: 'real' }]);
	});

	test('reports denied when the prompt is refused', async () => {
		setUpStore();
		stubBrowser({ permission: undefined, getUserMedia: refuse });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.access.value).toBe('denied');
	});

	test('reports unavailable when there is no device to grant', async () => {
		setUpStore();
		stubBrowser({ permission: undefined, getUserMedia: missing });
		getLocalDevices.mockImplementation(() => Promise.resolve([]));

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.access.value).toBe('unavailable');
		expect(devices.devicesLoaded.value).toBe(true);
	});

	test('falls back to audio only when a combined request finds no camera', async () => {
		setUpStore();
		const getUserMedia = vi
			.fn()
			.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotFoundError' }))
			.mockResolvedValueOnce({ getTracks: () => [] });
		stubBrowser({ permission: undefined, getUserMedia });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(getUserMedia).toHaveBeenNthCalledWith(1, { audio: true, video: true });
		expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
		expect(devices.access.value).toBe('granted');
	});

	test('still finishes loading when enumerating throws', async () => {
		setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });
		getLocalDevices.mockImplementation(() => Promise.reject(new Error('device busy')));

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.devicesLoaded.value).toBe(true);
	});

	test('spins for a minimum so a warm refresh is not a twitch', async () => {
		setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		expect(devices.refreshing.value).toBe(true);
		vi.advanceTimersByTime(599);
		expect(devices.refreshing.value).toBe(true);
		vi.advanceTimersByTime(1);
		expect(devices.refreshing.value).toBe(false);
	});

	test('choosing a device routes through the store', async () => {
		const videoCall = setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();
		vi.clearAllMocks();

		devices.outputDevice.value = { label: 'Other speaker', value: 'speaker-2' };
		await nextTick();

		expect(videoCall.changeOutputDevice).toHaveBeenCalledWith('speaker-2');
	});

	test('clearing a device tells the store to use none', async () => {
		const videoCall = setUpStore();
		stubBrowser({ permission: 'granted', getUserMedia: grant });

		const devices = useVideoCallDevices();
		await devices.setUpDevices();

		// Actions are stubbed, so mirror what a real changeVideoDevice would have recorded.
		devices.videoDevice.value = { label: 'First videoinput', value: 'videoinput-1' };
		videoCall.selected_video_device_id = 'videoinput-1';
		await nextTick();
		vi.clearAllMocks();

		devices.videoDevice.value = undefined;
		await nextTick();

		expect(videoCall.changeVideoDevice).toHaveBeenCalledWith(null);
	});
});
