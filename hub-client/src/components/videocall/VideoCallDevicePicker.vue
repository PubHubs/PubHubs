<template>
	<div class="flex flex-wrap justify-center gap-100">
		<VideoCallDevicePill
			v-model="audioDevice"
			class="min-w-1500 flex-1"
			icon="microphone"
			:label="t('videocall.microphone_source')"
			:options="audioOptions"
			:placeholder="t('videocall.no_microphone')"
		/>
		<VideoCallDevicePill
			v-model="outputDevice"
			class="min-w-1500 flex-1"
			icon="speaker-high"
			:label="t('videocall.speaker_source')"
			:options="outputOptions"
			:placeholder="t('videocall.no_speaker')"
		/>
		<VideoCallDevicePill
			v-model="videoDevice"
			class="min-w-1500 flex-1"
			icon="video"
			:label="t('videocall.video_source')"
			:options="videoOptions"
			:placeholder="t('videocall.no_camera')"
		/>
		<Button
			class="rounded-full"
			:class="{ 'animate-spin': refreshing }"
			icon="arrows-clockwise"
			:title="t('videocall.refresh_devices')"
			variant="secondary"
			@click="setUpDevices()"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import VideoCallDevicePill from '@hub-client/components/videocall/VideoCallDevicePill.vue';

	// Composables
	import { useVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

	const { t } = useI18n();
	const { audioDevice, audioOptions, outputDevice, outputOptions, refreshing, setUpDevices, videoDevice, videoOptions } = useVideoCallDevices();
</script>
