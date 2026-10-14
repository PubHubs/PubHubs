<template>
	<div
		class="rounded-large relative max-h-[50vh] w-full overflow-hidden bg-black"
		:style="{ aspectRatio: previewAspect }"
	>
		<video
			v-show="showVideo"
			ref="videoEl"
			class="h-full w-full object-cover"
			disablepictureinpicture
			muted
			tabindex="-1"
			@loadedmetadata="readStreamOrientation()"
			@resize="readStreamOrientation()"
		/>

		<div
			v-if="!showVideo"
			class="bg-surface-base flex h-full w-full items-center justify-center"
			:class="placeholderColor"
		>
			<div class="aspect-square h-1/2">
				<Icon
					aria-hidden="true"
					class="h-full! w-full!"
					type="user"
				/>
			</div>
		</div>

		<div
			v-show="micActive"
			class="border-accent-primary rounded-large pointer-events-none absolute inset-0 border-2 transition-opacity duration-75 ease-linear"
			:style="{ opacity: borderOpacity }"
		/>

		<span
			class="absolute bottom-200 left-200 flex drop-shadow-md transition-opacity duration-75 ease-linear"
			:class="showVideo ? 'text-white' : 'text-on-surface'"
			:style="{ opacity: iconOpacity }"
		>
			<Icon
				aria-hidden="true"
				:type="micActive ? 'microphone' : 'microphone-slash'"
			/>
		</span>

		<div class="absolute inset-x-0 bottom-200 flex justify-center gap-100">
			<Button
				:disabled="!videoCall.audio_track"
				:icon="micActive ? 'microphone' : 'microphone-slash'"
				:title="micActive ? t('videocall.mute_microphone') : t('videocall.unmute_microphone')"
				:variant="micActive ? 'secondary' : 'error'"
				@click="videoCall.toggleAudioTrackMute(micActive)"
			/>
			<Button
				:disabled="!videoCall.video_track"
				:icon="cameraActive ? 'video' : 'video-camera-slash'"
				:title="cameraActive ? t('videocall.disable_camera') : t('videocall.enable_camera')"
				:variant="cameraActive ? 'secondary' : 'error'"
				@click="videoCall.toggleVideoTrackMute(cameraActive)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeUnmount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Stores
	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const { t } = useI18n();
	const { color, textColor } = useUserColor();
	const user = useUser();
	const videoCall = useVideoCall();

	// The same accent the user's name is elsewhere
	const placeholderColor = computed(() => (user.userId ? textColor(color(user.userId)) : 'text-on-surface-dim'));

	const videoEl = ref<HTMLVideoElement | null>(null);

	const videoSource = computed(() => videoCall.video_track);
	const audioSource = computed(() => videoCall.audio_track);
	const micActive = computed(() => !!videoCall.audio_track && !videoCall.mute_audio_track);
	const cameraActive = computed(() => !!videoCall.video_track && !videoCall.mute_video_track);
	const showVideo = computed(() => !!videoSource.value && cameraActive.value);

	const streamIsPortrait = ref(false);
	const previewAspect = computed(() => (streamIsPortrait.value && showVideo.value ? '3 / 4' : '16 / 9'));

	const fullScale = 0.2;
	const noiseFloor = 0.05;
	const attack = 0.5;
	const release = 0.12;

	const level = ref(0);

	// Neither cue drops to nothing while the microphone is live: silence should read as "on but quiet"
	// rather than as "off". A muted microphone shows its crossed-out icon at full strength instead.
	const borderOpacity = computed(() => 0.1 + level.value * 0.9);
	const iconOpacity = computed(() => (micActive.value ? 0.35 + level.value * 0.65 : 1));

	const audioContext = new AudioContext();

	let meterSource: MediaStreamAudioSourceNode | null = null;
	let meterNode: AudioWorkletNode | null = null;

	watch(videoSource, (videoTrack) => {
		if (videoEl.value && videoTrack) {
			videoTrack.attach(videoEl.value);
		}
		if (!videoEl.value && videoTrack) {
			videoTrack.detach();
		}
	});

	watch(audioSource, async (audioTrack) => {
		disconnectMeter();
		if (!audioTrack?.mediaStream) return;

		await audioContext.audioWorklet.addModule('/audioLevelProcessor.js');
		meterSource = audioContext.createMediaStreamSource(audioTrack.mediaStream);
		meterNode = new AudioWorkletNode(audioContext, 'audiolevel');
		addNodeMessageListener(meterNode);
		meterSource.connect(meterNode).connect(audioContext.destination);
	});

	watch(micActive, (active) => {
		if (!active) {
			level.value = 0;
		}
	});

	onBeforeUnmount(() => {
		disconnectMeter();
		void audioContext.close();
	});

	function disconnectMeter() {
		if (meterNode) {
			meterNode.port.onmessage = null;
			meterNode.disconnect();
			meterNode = null;
		}
		meterSource?.disconnect();
		meterSource = null;
	}

	function readStreamOrientation() {
		const element = videoEl.value;
		if (!element?.videoWidth || !element.videoHeight) return;
		streamIsPortrait.value = element.videoHeight > element.videoWidth;
	}

	function addNodeMessageListener(node: AudioWorkletNode) {
		node.port.onmessage = (event) => {
			const channels = event.data.volume as { value: number }[] | undefined;
			if (!channels || !micActive.value) return;

			const loudest = channels.reduce((max, channel) => Math.max(max, channel.value), 0);
			const scaled = Math.min(loudest / fullScale, 1);
			const target = scaled < noiseFloor ? 0 : (scaled - noiseFloor) / (1 - noiseFloor);

			level.value += (target - level.value) * (target > level.value ? attack : release);
		};
	}
</script>
