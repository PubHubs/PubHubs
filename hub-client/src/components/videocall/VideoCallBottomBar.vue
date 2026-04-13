<template>
	<div class="fixed bottom-0 flex h-20 w-9/12 items-center justify-between px-4">
		<div class="flex items-center space-x-4">
			<!-- TODO: add language variables -->
			<Button
				variant="error"
				@click="endCall"
				>End call</Button
			>
			<Button
				variant="primary"
				@click="leaveCall"
				>Leave call</Button
			>
			<Button
				variant="primary"
				@click="toggleAudio"
				>{{ muteAudio ? 'Unmute Microphone' : 'Mute Microphone' }}</Button
			>
			<Button
				variant="primary"
				@click="toggleVideo"
				>{{ muteVideo ? 'Enable Camera' : 'Disable Camera' }}</Button
			>
			<Button
				variant="primary"
				@click="toggleScreenShare"
				>{{ screenShare ? 'Stop Screen Sharing' : 'Start Screen Sharing' }}</Button
			>
			<Button
				variant="primary"
				@click="toggleSelfView"
				>{{ selfView ? 'Hide self view' : 'Show self view' }}</Button
			>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRouter } from 'vue-router';

	import type Room from '@hub-client/models/rooms/Room';

	import useVideoCall from '@hub-client/stores/videoCall';

	import Button from '@hub-client/new-design/components/Button.vue';

	const props = defineProps<{
		currentRoom: Room;
	}>();

	const videoCall = useVideoCall();
	const router = useRouter();
	const muteAudio = ref(false);
	const muteVideo = ref(false);
	const screenShare = ref(false);
	const selfView = ref(videoCall.selfView);

	async function leaveCall() {
		if (videoCall.livekit_room?.remoteParticipants.size === 0) {
			await endCall();
		} else {
			router.push({ name: 'room', params: { id: props.currentRoom.roomId } });
			await videoCall.leaveCall();
		}
	}

	async function endCall() {
		await videoCall.endCall();
		router.push({ name: 'room', params: { id: props.currentRoom.roomId } });
	}

	const toggleAudio = () => {
		muteAudio.value = !muteAudio.value;
		videoCall.toggleAudioTrackMute(muteAudio.value);
	};

	const toggleVideo = () => {
		muteVideo.value = !muteVideo.value;
		videoCall.toggleVideoTrackMute(muteVideo.value);
	};

	const toggleScreenShare = () => {
		screenShare.value = !screenShare.value;
		videoCall.toggleScreenShare(screenShare.value);
	};

	const toggleSelfView = () => {
		videoCall.toggleSelfView(selfView.value);
		selfView.value = videoCall.selfView;
	};
</script>
