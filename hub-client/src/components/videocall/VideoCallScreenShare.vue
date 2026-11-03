<template>
	<div
		class="relative m-100 flex aspect-video flex-col justify-center rounded-md bg-black p-100"
		:class="props.size"
		@click="toggleFocus"
	>
		<div class="bg-opacity-50 py-050 absolute top-200 left-200 rounded-md bg-black px-100">
			<UserDisplayName
				class="text-sm text-white"
				:user-id="participantUserId"
				:user-display-name="user.userDisplayName(participantUserId)"
			/>
		</div>
		<div>
			<video
				ref="screenShareEl"
				:class="['aspect-video', 'self-center', 'w-full', 'h-full', 'bg-black']"
				playsInline
				preload="auto"
				tabIndex="{-1}"
				autoplay="true"
				muted="false"
				disablepictureinpicture="true"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { type Participant, ParticipantEvent, type RemoteTrack, Track } from 'livekit-client';
	import { computed, onBeforeUnmount, ref, watch } from 'vue';

	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		username: string;
		participant: Participant;
		size: string;
	}>();
	const videoCall = useVideoCall();
	const user = useUser();
	const screenShareEl = ref<HTMLVideoElement | null>(null);
	const participantUserId = computed(() => computeParticipantId(props.username));

	const screenShareTrack = () => props.participant.getTrackPublication(Track.Source.ScreenShare)?.track;

	const attachScreenShare = () => {
		const track = screenShareTrack();
		if (track && screenShareEl.value) {
			track.attach(screenShareEl.value);
		}
	};

	// The publication can arrive before its track is subscribed (E2EE makes this slower), so attach on subscription too.
	const onTrackSubscribed = (track: RemoteTrack) => {
		if (track.source === Track.Source.ScreenShare) {
			attachScreenShare();
		}
	};

	watch(
		() => props.participant,
		(participant, oldParticipant) => {
			oldParticipant?.off(ParticipantEvent.TrackSubscribed, onTrackSubscribed);
			participant.on(ParticipantEvent.TrackSubscribed, onTrackSubscribed);
			attachScreenShare();
		},
		{ immediate: true },
	);

	watch(screenShareEl, attachScreenShare);

	onBeforeUnmount(() => {
		props.participant.off(ParticipantEvent.TrackSubscribed, onTrackSubscribed);
		const track = screenShareTrack();
		if (track && screenShareEl.value) {
			track.detach(screenShareEl.value);
		}
	});

	function computeParticipantId(user: string): string {
		const lastColonIndex = user.lastIndexOf(':');
		return lastColonIndex !== -1 ? user.slice(0, lastColonIndex) : user;
	}

	function toggleFocus() {
		if (videoCall.focus[0] === props.participant && videoCall.focus[1] === true) {
			videoCall.toggleFocus(null, false);
		} else {
			videoCall.toggleFocus(props.participant, true);
		}
	}
</script>
