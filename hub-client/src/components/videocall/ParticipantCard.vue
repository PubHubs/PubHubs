<template>
	<div class="group bg-surface-base rounded-base flex items-center justify-between overflow-hidden py-100 pr-200 pl-100">
		<div class="flex w-full items-center gap-100 truncate">
			<div class="flex h-fit w-full flex-col overflow-hidden">
				<UserDisplayName
					:user-id="participantUserId"
					:user-display-name="user.userDisplayName(participantUserId)"
				/>
			</div>
			<span
				v-if="isSelf"
				class="text-on-surface-dim text-label-small shrink-0"
				>{{ t('videocall.you') }}</span
			>
		</div>
		<Icon
			v-if="!cameraOn"
			type="video-camera-slash"
			size="sm"
			class="text-on-surface-dim rounded-md stroke-0 p-100"
		/>
		<Icon
			v-if="!micOn"
			type="microphone-slash"
			size="sm"
			class="text-on-surface-dim rounded-md stroke-0 p-100"
		/>
		<div v-if="!isSelf">
			<Icon
				type="dots-three-vertical"
				size="sm"
				class="hover:text-accent-primary stroke-0 p-100 hover:cursor-pointer"
				@click.stop="toggleDropDown()"
			></Icon>
			<div
				v-if="expandDrowpDown"
				ref="dropDown"
				class="bg-surface absolute right-200 z-10 rounded-md shadow-lg"
			>
				<Button
					variant="secondary"
					@click="toggleMute"
				>
					{{ isLocallyMuted ? t('videocall.unmute_for_me') : t('videocall.mute_for_me') }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = withDefaults(
		defineProps<{
			remoteParticipantName: string;
			isSelf?: boolean;
		}>(),
		{ isSelf: false },
	);

	const { t } = useI18n();
	const videoCall = useVideoCall();
	const user = useUser();
	const remoteParticipant = ref(videoCall.getRemoteParticipant(props.remoteParticipantName));
	const isMicrophoneEnabled = ref(remoteParticipant.value?.isMicrophoneEnabled);
	const isCameraEnabled = ref(remoteParticipant.value?.isCameraEnabled);
	const isLocallyMuted = ref(videoCall.isLocallyMuted(props.remoteParticipantName));
	const expandDrowpDown = ref(false);
	const dropDown = ref<HTMLElement | null>(null);
	const participantUserId = ref(computeParticipantId(props.remoteParticipantName));

	// LiveKit only reports the state of remote participants; our own comes from the store.
	const micOn = computed(() =>
		props.isSelf
			? !!videoCall.audio_track && !videoCall.mute_audio_track
			: isMicrophoneEnabled.value && !videoCall.isLocallyMuted(props.remoteParticipantName),
	);
	const cameraOn = computed(() => (props.isSelf ? !!videoCall.video_track && !videoCall.mute_video_track : isCameraEnabled.value));

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
