<template>
	<div class="flex w-full shrink-0 flex-col items-center gap-200 p-200">
		<VideoCallDevicePicker
			v-if="showDevices"
			class="w-full max-w-7000"
		/>

		<div class="flex items-center justify-center gap-100">
			<Button
				:icon="muteAudio ? 'microphone-slash' : 'microphone'"
				:title="muteAudio ? t('videocall.unmute_microphone') : t('videocall.mute_microphone')"
				:variant="muteAudio ? 'error' : 'secondary'"
				@click="toggleAudio()"
			/>
			<Button
				:icon="muteVideo ? 'video-camera-slash' : 'video'"
				:title="muteVideo ? t('videocall.enable_camera') : t('videocall.disable_camera')"
				:variant="muteVideo ? 'error' : 'secondary'"
				@click="toggleVideo()"
			/>
			<Button
				icon="screencast"
				:title="screenShare ? t('videocall.stop_screen_share') : t('videocall.start_screen_share')"
				:variant="screenShare ? 'primary' : 'secondary'"
				@click="void toggleScreenShare()"
			/>
			<Button
				icon="sliders-horizontal"
				:title="t('videocall.devices')"
				:variant="showDevices ? 'primary' : 'secondary'"
				@click="toggleDevices()"
			/>
			<Button
				:icon="selfView ? 'eye' : 'eye-slash'"
				:title="selfView ? t('videocall.hide_self_view') : t('videocall.show_self_view')"
				variant="secondary"
				@click="toggleSelfView()"
			/>
			<Button
				:icon="isFullscreen ? 'arrows-in' : 'arrows-out'"
				:title="t('videocall.fullscreen_tooltip')"
				variant="secondary"
				@click="$emit('toggle-fullscreen')"
			/>
			<Button
				icon="phone-disconnect"
				:title="t('videocall.leave_call')"
				variant="error"
				@click="leaveCall()"
			/>
		</div>

		<VideoCallPermissionDialog
			v-if="screenShareRefused"
			state="screenshare"
			@close="screenShareRefused = false"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import VideoCallDevicePicker from '@hub-client/components/videocall/VideoCallDevicePicker.vue';
	import VideoCallPermissionDialog from '@hub-client/components/videocall/VideoCallPermissionDialog.vue';

	// Composables
	import { useVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

	// Models
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		currentRoom: Room;
		isFullscreen: boolean;
	}>();

	defineEmits<{
		(e: 'toggle-fullscreen'): void;
	}>();

	const { t } = useI18n();
	const videoCall = useVideoCall();
	const router = useRouter();
	const { setUpDevices } = useVideoCallDevices();

	// Read from the store: the pre-join screen can already have muted before we get here.
	const muteAudio = computed(() => videoCall.mute_audio_track);
	const muteVideo = computed(() => videoCall.mute_video_track);
	const screenShare = computed(() => videoCall.screen_share);
	const selfView = ref(videoCall.selfView);
	const showDevices = ref(false);
	const screenShareRefused = ref(false);

	const toggleDevices = () => {
		showDevices.value = !showDevices.value;
		// Devices can have been plugged in or unplugged since they were last enumerated.
		if (showDevices.value) void setUpDevices();
	};

	async function leaveCall() {
		try {
			await videoCall.leaveCall();
		} finally {
			router.push({ name: 'room', params: { id: props.currentRoom.roomId } });
		}
	}

	const toggleAudio = () => {
		void videoCall.toggleAudioTrackMute(!muteAudio.value);
	};

	const toggleVideo = () => {
		void videoCall.toggleVideoTrackMute(!muteVideo.value);
	};

	const toggleScreenShare = async () => {
		const wanted = !screenShare.value;
		const succeeded = await videoCall.toggleScreenShare(wanted);
		// Only worth explaining when starting: stopping cannot be refused.
		screenShareRefused.value = wanted && !succeeded;
	};

	const toggleSelfView = () => {
		videoCall.toggleSelfView(selfView.value);
		selfView.value = videoCall.selfView;
	};
</script>
