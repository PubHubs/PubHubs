<template>
	<div
		class="relative m-100 flex aspect-video flex-col justify-center rounded-md p-100"
		:class="[props.size, isSpeaking ? 'bg-accent-primary' : 'bg-black']"
		@click="toggleFocus"
	>
		<!-- The self-view is too small for the stacked overlay, so it gets a single line instead -->
		<div
			v-if="props.isSelfView"
			class="py-025 px-075 absolute top-200 right-200 left-200 flex w-fit min-w-0 items-center gap-100 rounded-md bg-black"
		>
			<span class="text-label-tiny shrink-0 text-white">{{ t('videocall.self_label') }}</span>
			<RoomBadge
				v-if="rooms.currentRoom && !rooms.currentRoom.isDirectMessageRoom()"
				class="px-050! min-w-0 border! py-0!"
				:user="participantUserId"
				:room-id="rooms.currentRoom.roomId"
			/>
		</div>
		<div
			v-else
			class="text-label-small py-025 gap-025 px-075 absolute top-200 left-200 flex flex-col items-start rounded-md bg-black"
		>
			<UserDisplayName
				class="text-label-tiny text-white"
				:user-id="participantUserId"
				:user-display-name="user.userDisplayName(participantUserId)"
			/>
			<span
				v-if="rooms.currentRoom && !rooms.currentRoom.isDirectMessageRoom()"
				class="text-label-tiny"
			>
				<RoomBadge
					class="px-050! border! py-0!"
					:user="participantUserId"
					:room-id="rooms.currentRoom.roomId"
				/>
			</span>
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
				class="bg-surface-base flex aspect-video h-full w-full items-center justify-center"
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
				v-if="!participant.isMicrophoneEnabled || isLocallyMuted"
				class="bg-opacity-50 p-050 absolute bottom-200 left-200 rounded-full bg-black"
			>
				<Icon
					type="microphone-slash"
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
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	import { useUserColor } from '@hub-client/composables/useUserColor';

	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		username: string;
		participant: Participant;
		size: string;
		isSelfView: boolean;
	}>();

	const { t } = useI18n();
	const { color, textColor } = useUserColor();
	const videoCall = useVideoCall();
	const user = useUser();
	const rooms = useRooms();
	const videoEl = ref<HTMLVideoElement | null>(null);
	const audioEl = ref<HTMLAudioElement | null>(null);
	const participantUserId = computed(() => computeParticipantId(props.username));

	// The same accent as participant's name
	const placeholderColor = computed(() => textColor(color(participantUserId.value)));
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
