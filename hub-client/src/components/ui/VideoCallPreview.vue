<template>
	<div class="flex h-full w-full flex-col">
		<div class="mb-10 aspect-video w-8/12 self-center bg-black">
			<video
				ref="videoEl"
				muted
				tabIndex="{-1}"
				disablepictureinpicture="true"
				:class="[videoSource ? '' : 'hidden']"
			/>
			<div
				class="aspect-video h-full w-full bg-black"
				:class="[videoSource ? 'hidden' : '']"
			>
				<Icon
					type="person"
					size="xl"
					class="h-full w-full text-white"
				></Icon>
			</div>
		</div>
		<div class="">
			<AudioPreview :volume="currentVolumeLeft" />
			<AudioPreview :volume="currentVolumeRight" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onBeforeUnmount, ref, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import AudioPreview from '@hub-client/components/ui/AudioPreview.vue';

	import useVideoCall from '@hub-client/stores/videoCall';

	const videoEl = ref<HTMLVideoElement | null>(null);

	const videoCall = useVideoCall();
	const videoSource = computed(() => videoCall.video_track);
	const audioSource = computed(() => videoCall.audio_track);

	const averageAmount = 3;

	const currentVolumeLeft = ref(0);
	const currentVolumeRight = ref(0);

	const currentVolumeArrayLeft = Array(averageAmount).fill(0);
	const currentVolumeArrayRight = Array(averageAmount).fill(0);

	let currentVolumeIndex = 0;

	let audioContext = new AudioContext();
	const analyser = audioContext.createAnalyser();

	watch(videoSource, (videoTrack) => {
		if (videoEl.value && videoTrack) {
			videoTrack.attach(videoEl.value);
		}
		if (!videoEl.value && videoTrack) {
			videoTrack.detach();
		}
	});

	watch(audioSource, async (audioTrack) => {
		if (audioTrack && audioTrack.mediaStream) {
			await audioContext.audioWorklet.addModule('/audioLevelProcessor.js');
			const audioSource = audioContext.createMediaStreamSource(audioTrack.mediaStream);
			audioSource.connect(analyser);

			const node = new AudioWorkletNode(audioContext, 'audiolevel');
			addNodeMessageListener(node);
			audioSource.connect(node).connect(audioContext.destination);
		}
	});

	onBeforeUnmount(() => {
		if (audioContext.state === 'running') {
			audioContext.close();
		}
	});

	function addNodeMessageListener(node: AudioWorkletNode) {
		node.port.onmessage = (event) => {
			if (event.data.volume as number[]) {
				if (event.data.volume.length > 0) {
					currentVolumeArrayLeft[currentVolumeIndex] = event.data.volume[0].value * 10;
				} else {
					currentVolumeArrayLeft[currentVolumeIndex] = 0;
				}
				if (event.data.volume.length > 1) {
					currentVolumeArrayRight[currentVolumeIndex] = event.data.volume[1].value * 10;
				} else {
					currentVolumeArrayRight[currentVolumeIndex] = 0;
				}
				currentVolumeIndex = (currentVolumeIndex + 1) % averageAmount;

				if (currentVolumeIndex === 0) {
					const left = parseFloat((currentVolumeArrayLeft.reduce((a, b) => a + b) / averageAmount).toFixed(1));
					const right = parseFloat((currentVolumeArrayRight.reduce((a, b) => a + b) / averageAmount).toFixed(1));
					if (currentVolumeLeft.value !== left) {
						currentVolumeLeft.value = left;
					}

					if (currentVolumeRight.value !== right) {
						currentVolumeRight.value = right;
					}
				}
			}
		};
	}
</script>
