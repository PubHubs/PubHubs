<template>
	<div
		class="relative m-2 flex aspect-video flex-col justify-center rounded-md bg-black p-2"
		:class="props.size"
		@click="toggleFocus"
	>
		<div class="bg-opacity-50 absolute top-4 left-4 rounded-md bg-black px-2 py-1">
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
	import { type Participant, Track } from 'livekit-client';
	import { computed, ref, watch } from 'vue';

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

	watch(
		[props.participant, screenShareEl],
		([remote, screenShareElement]) => {
			const screenShareTrack = remote.getTrackPublication(Track.Source.ScreenShare);
			if (!screenShareElement || !screenShareTrack) {
				return;
			}

			// Need to repopulate the video element, else it will nog work...
			setTimeout(function () {
				const temp_new_screen_share_el = screenShareTrack.track?.attach(screenShareElement) as HTMLVideoElement | undefined;

				if (temp_new_screen_share_el) {
					screenShareEl.value = temp_new_screen_share_el;
				}
			}, 100);

			document.body.addEventListener(
				'click',
				() => {
					let ScreenShareTrackNew = remote.getTrackPublication(Track.Source.ScreenShare);

					if (!ScreenShareTrackNew) {
						return;
					}

					const temp_new_screen_share_el = ScreenShareTrackNew.track?.attach(screenShareElement) as HTMLVideoElement | undefined;
					if (temp_new_screen_share_el) {
						screenShareEl.value = temp_new_screen_share_el;
					}
				},
				{ once: true },
			);
		},
		{ deep: true },
	);

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
