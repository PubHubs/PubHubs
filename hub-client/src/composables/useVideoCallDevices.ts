// Packages
import { Room as LivekitRoom } from 'livekit-client';
import { type EffectScope, effectScope, ref, watch } from 'vue';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { type FieldOption } from '@hub-client/models/validation/TFormOption';
import { type TDeviceAccess } from '@hub-client/models/videocall/TDeviceAccess';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

const logger = createLogger('useVideoCallDevices');

const minimumSpin = 600;

const toOption = (device: MediaDeviceInfo): FieldOption => ({ label: device.label, value: device.deviceId });

const usableDevices = (devices: MediaDeviceInfo[]): MediaDeviceInfo[] => devices.filter((device) => device.deviceId && device.label);

const defaultDeviceId = (devices: MediaDeviceInfo[]): string | undefined => (devices.find((device) => device.deviceId === 'default') ?? devices[0])?.deviceId;

const optionForDeviceId = (options: FieldOption[], deviceId: string | null): FieldOption | undefined => options.find((option) => option.value === deviceId);

/**
 * Chrome can tell us up front whether it will prompt, which keeps the permission notice from showing
 * to everyone who already granted access. Firefox and Safari do not expose this, so there we assume a
 * prompt is coming and show the notice while it is open.
 */
const knownDeviceAccess = async (): Promise<TDeviceAccess | undefined> => {
	// 'microphone' sits outside the standard PermissionName union, so query it through a narrower type.
	const permissions = navigator.permissions as { query: (descriptor: { name: string }) => Promise<{ state: string }> };

	try {
		const { state } = await permissions.query({ name: 'microphone' });
		if (state === 'granted') return 'granted';
		if (state === 'denied') return 'denied';
	} catch {
		// Permission name not supported here.
	}
	return undefined;
};

/**
 * Ask the browser for the microphone and camera. Nothing else can be shown until this resolves:
 * device labels stay empty until the user grants access.
 */
const requestDeviceAccess = async (): Promise<TDeviceAccess> => {
	// One combined prompt in the common case. A machine without a camera rejects the combined
	// request outright, so fall back to audio only rather than leaving the user unable to grant.
	for (const constraints of [{ audio: true, video: true }, { audio: true }]) {
		try {
			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			// We only wanted the grant; the store creates the tracks we actually publish.
			stream.getTracks().forEach((track) => track.stop());
			return 'granted';
		} catch (error) {
			if ((error as DOMException).name === 'NotAllowedError') return 'denied';
		}
	}
	return 'unavailable';
};

const audioOptions = ref<FieldOption[]>([]);
const outputOptions = ref<FieldOption[]>([]);
const videoOptions = ref<FieldOption[]>([]);

const audioDevice = ref<FieldOption>();
const outputDevice = ref<FieldOption>();
const videoDevice = ref<FieldOption>();

const access = ref<TDeviceAccess>('pending');
const devicesLoaded = ref(false);
const refreshing = ref(false);

let spinTimeout: number | undefined;

let scope: EffectScope | undefined;

const startWatching = () => {
	if (scope) return;

	scope = effectScope(true);
	scope.run(() => {
		watch(audioDevice, (option) => {
			const videoCall = useVideoCall();
			if ((option?.value ?? null) === videoCall.selected_audio_device_id) return;
			void videoCall.changeAudioDevice(option?.value ?? null);
		});

		watch(videoDevice, (option) => {
			const videoCall = useVideoCall();
			if ((option?.value ?? null) === videoCall.selected_video_device_id) return;
			void videoCall.changeVideoDevice(option?.value ?? null);
		});

		watch(outputDevice, (option) => {
			const videoCall = useVideoCall();
			if ((option?.value ?? null) === videoCall.selected_output_device_id) return;
			void videoCall.changeOutputDevice(option?.value ?? null);
		});
	});
};

const resetVideoCallDevices = () => {
	scope?.stop();
	scope = undefined;
	window.clearTimeout(spinTimeout);

	audioOptions.value = [];
	outputOptions.value = [];
	videoOptions.value = [];
	audioDevice.value = undefined;
	outputDevice.value = undefined;
	videoDevice.value = undefined;
	access.value = 'pending';
	devicesLoaded.value = false;
	refreshing.value = false;
};

/**
 * Device lists and the current selection for the microphone, speaker and camera pills. Shared state,
 * so the pre-join screen and the in-call device row stay in step with each other and the store.
 */
function useVideoCallDevices() {
	const videoCall = useVideoCall();

	startWatching();

	const findDevices = async () => {
		const audioDevices = usableDevices(await LivekitRoom.getLocalDevices('audioinput'));
		const outputDevices = usableDevices(await LivekitRoom.getLocalDevices('audiooutput'));
		const videoDevices = usableDevices(await LivekitRoom.getLocalDevices('videoinput'));

		audioOptions.value = audioDevices.map(toOption);
		outputOptions.value = outputDevices.map(toOption);
		videoOptions.value = videoDevices.map(toOption);

		const defaultAudioDeviceId = defaultDeviceId(audioDevices);
		if (!videoCall.selected_audio_device_id && defaultAudioDeviceId) {
			await videoCall.changeAudioDevice(defaultAudioDeviceId);
		}

		const defaultOutputDeviceId = defaultDeviceId(outputDevices);
		if (!videoCall.selected_output_device_id && defaultOutputDeviceId) {
			await videoCall.changeOutputDevice(defaultOutputDeviceId);
		}

		const defaultVideoDeviceId = defaultDeviceId(videoDevices);
		if (!videoCall.selected_video_device_id && defaultVideoDeviceId) {
			await videoCall.changeVideoDevice(defaultVideoDeviceId);
		}

		audioDevice.value = optionForDeviceId(audioOptions.value, videoCall.selected_audio_device_id);
		outputDevice.value = optionForDeviceId(outputOptions.value, videoCall.selected_output_device_id);
		videoDevice.value = optionForDeviceId(videoOptions.value, videoCall.selected_video_device_id);
	};

	const setUpDevices = async () => {
		const startedAt = Date.now();
		devicesLoaded.value = false;
		window.clearTimeout(spinTimeout);
		refreshing.value = true;
		access.value = (await knownDeviceAccess()) ?? 'pending';

		try {
			access.value = await requestDeviceAccess();
			await findDevices();
		} catch (error) {
			// A device can be missing or claimed by another application. Let the user carry on.
			logger.error('Could not set up the video call devices', { error });
		} finally {
			devicesLoaded.value = true;
			spinTimeout = window.setTimeout(() => (refreshing.value = false), Math.max(0, minimumSpin - (Date.now() - startedAt)));
		}
	};

	return { access, audioDevice, audioOptions, devicesLoaded, outputDevice, outputOptions, refreshing, setUpDevices, videoDevice, videoOptions };
}

export { resetVideoCallDevices, useVideoCallDevices };
