<template>
	<div class="group bg-surface-low m-3 mb-0 flex items-center justify-between overflow-hidden rounded-md py-2 pr-4 pl-2">
		<div class="flex w-full items-center gap-2 truncate">
			<div class="flex h-fit w-full flex-col overflow-hidden">
				<UserDisplayName
					:user-id="participantUserId"
					:user-display-name="user.userDisplayName(participantUserId)"
				/>
			</div>
		</div>
		<Icon
			v-if="!isCameraEnabled"
			type="video_mute"
			size="sm"
			class="text-on-surface-variant rounded-md stroke-0 p-2"
		/>
		<Icon
			v-if="!isMicrophoneEnabled || videoCall.isLocallyMuted(remoteParticipantName)"
			type="microphone_mute"
			size="sm"
			class="text-on-surface-variant rounded-md stroke-0 p-2"
		/>
		<div>
			<Icon
				type="dots"
				size="sm"
				class="hover:text-accent-primary stroke-0 p-2 hover:cursor-pointer"
				@click.stop="toggleDropDown()"
			></Icon>
			<div
				v-if="expandDrowpDown"
				ref="dropDown"
				class="bg-surface absolute right-4 z-10 rounded-md shadow-lg"
			>
				<Button
					:color="'gray-100'"
					@click="toggleMute"
				>
					{{ isLocallyMuted ? 'Unmute for me' : 'Mute for me' }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import UserDisplayName from '../rooms/UserDisplayName.vue';
	import { onMounted, onUnmounted, ref, watch } from 'vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		remoteParticipantName: string;
	}>();

	const videoCall = useVideoCall();
	const user = useUser();
	const remoteParticipant = ref(videoCall.getRemoteParticipant(props.remoteParticipantName));
	const isMicrophoneEnabled = ref(remoteParticipant.value?.isMicrophoneEnabled);
	const isCameraEnabled = ref(remoteParticipant.value?.isCameraEnabled);
	const isLocallyMuted = ref(videoCall.isLocallyMuted(props.remoteParticipantName));
	const expandDrowpDown = ref(false);
	const dropDown = ref<HTMLElement | null>(null);
	const participantUserId = ref(computeParticipantId(props.remoteParticipantName));

	watch(
		[remoteParticipant],
		([remote]) => {
			if (!remote) return;
			isCameraEnabled.value = remote.isCameraEnabled;
			isMicrophoneEnabled.value = remote.isMicrophoneEnabled;
			isLocallyMuted.value = videoCall.isLocallyMuted(props.remoteParticipantName);
		},
		{ deep: true },
	);

	onMounted(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside);
	});

	function toggleMute() {
		videoCall.toggleLocalMute(props.remoteParticipantName);
		isLocallyMuted.value = videoCall.isLocallyMuted(props.remoteParticipantName);
		toggleDropDown();
	}

	function computeParticipantId(user: string): string {
		const lastColonIndex = user.lastIndexOf(':');
		return lastColonIndex !== -1 ? user.slice(0, lastColonIndex) : user;
	}

	function toggleDropDown() {
		expandDrowpDown.value = !expandDrowpDown.value;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropDown.value && !dropDown.value.contains(event.target as Node)) {
			expandDrowpDown.value = false;
		}
	}
</script>
