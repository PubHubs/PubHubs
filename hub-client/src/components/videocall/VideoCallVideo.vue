<template>
	<div
		class="relative m-2 flex aspect-video flex-col justify-center rounded-md p-2"
		:class="[props.size, isSpeaking ? 'bg-accent-primary' : 'bg-black']"
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
				ref="videoEl"
				:class="['aspect-video', 'self-center', 'w-full', 'h-full', participant.isCameraEnabled ? '' : 'hidden']"
				playsInline
				preload="auto"
				tabIndex="{-1}"
				autoplay="true"
				muted
				disablepictureinpicture="true"
			/>
			<audio
				ref="audioEl"
				autoplay
			/>
			<div
				v-if="!participant.isCameraEnabled"
				class="aspect-video h-full w-full bg-black"
			>
				<Icon
					type="person"
					size="xl"
					class="h-full w-full text-white"
				/>
			</div>
			<div
				v-if="!participant.isMicrophoneEnabled || isLocallyMuted"
				class="bg-opacity-50 absolute bottom-4 left-4 rounded-full bg-black p-1"
			>
				<Icon
					type="microphone_mute"
					size="sm"
					class="text-white"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { type Participant, Track } from 'livekit-client';
	import { computed, nextTick, onMounted, ref, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		username: string;
		participant: Participant;
		size: string;
		isSelfView: boolean;
	}>();

	const videoCall = useVideoCall();
	const user = useUser();
	const videoEl = ref<HTMLVideoElement | null>(null);
	const audioEl = ref<HTMLAudioElement | null>(null);
	const participantUserId = computed(() => computeParticipantId(props.username));
	const isLocallyMuted = ref(videoCall.isLocallyMuted(props.username));
	const isSpeaking = ref(props.participant.isSpeaking);

	props.participant.on('isSpeakingChanged', () => {
		isSpeaking.value = props.participant.isSpeaking;
	});

	watch(
		[props.participant, videoEl, audioEl],
		([participant, videoElement, audioElement]) => {
			if (!(videoElement && audioElement)) {
				return;
			}

			let audioTrack = null;
			const videoTrack = participant.getTrackPublication(Track.Source.Camera);
			if (!props.isSelfView) {
				audioTrack = participant.getTrackPublication(Track.Source.Microphone);
			}

			if (audioElement && audioTrack) {
				if (!videoCall.isLocallyMuted(props.username)) {
					isLocallyMuted.value = false;
					audioTrack.track?.attach(audioElement);
				} else {
					isLocallyMuted.value = true;
				}
			}

			if (videoElement && videoTrack) {
				// Need to repopulate the video element, else it will not work...
				setTimeout(function () {
					const temp_new_video_el = videoTrack.track?.attach(videoElement) as HTMLVideoElement | undefined;

					if (temp_new_video_el) {
						videoEl.value = temp_new_video_el;
					}
				}, 100);

				document.body.addEventListener(
					'click',
					() => {
						let videoTrackNew = participant.getTrackPublication(Track.Source.Camera);

						if (!videoTrackNew) {
							return;
						}

						const temp_new_video_el = videoTrackNew.track?.attach(videoElement) as HTMLVideoElement | undefined;
						if (temp_new_video_el) {
							temp_new_video_el.muted = true;
							videoEl.value = temp_new_video_el;
						}
					},
					{ once: true },
				);
			}
		},
		{ deep: true },
	);

	// Handle tracks that arrive AFTER the component has rendered (e.g., for the caller
	// viewing the joiner — the track isn't subscribed yet when the watcher first fires).
	props.participant.on('trackSubscribed', (track) => {
		if (track.source === Track.Source.Camera && videoEl.value) {
			track.attach(videoEl.value);
		} else if (track.source === Track.Source.Microphone && audioEl.value && !props.isSelfView) {
			if (!videoCall.isLocallyMuted(props.username)) {
				isLocallyMuted.value = false;
				track.attach(audioEl.value);
			}
		}
	});

	// Handle already-subscribed tracks (e.g., when rejoining a call — the other
	// participant's tracks are already subscribed before this component mounts).
	onMounted(() => {
		nextTick(() => {
			const videoTrack = props.participant.getTrackPublication(Track.Source.Camera);
			if (videoTrack?.track && videoEl.value) {
				videoTrack.track.attach(videoEl.value);
			}

			if (!props.isSelfView) {
				const audioTrack = props.participant.getTrackPublication(Track.Source.Microphone);
				if (audioTrack?.track && audioEl.value && !videoCall.isLocallyMuted(props.username)) {
					audioTrack.track.attach(audioEl.value);
				}
			}
		});
	});

	// TODO: This should not be a local method since it is being used in other places.
	// FIRST THING IS TO MAKE VIDEO CALL UPDATE
	function computeParticipantId(user: string): string {
		const lastColonIndex = user.lastIndexOf(':');
		return lastColonIndex !== -1 ? user.slice(0, lastColonIndex) : user;
	}

	function toggleFocus() {
		if (videoCall.focus[0] === props.participant && videoCall.focus[1] === false) {
			videoCall.toggleFocus(null, false);
		} else {
			videoCall.toggleFocus(props.participant, false);
		}
	}
</script>
