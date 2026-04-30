<template>
	<div
		v-if="totalRemoteStreams === 0"
		class="flex h-full items-center justify-center"
	>
		<!-- TODO add language variable. -->
		<p>Nobody is here yet</p>
	</div>
	<div v-if="focus[0] && totalRemoteStreams > 1">
		<div class="mr-4 h-9/12 w-full overflow-x-scroll transition-all">
			<div class="flex flex-nowrap space-x-4">
				<div
					v-for="participant in props.remoteParticipants"
					:key="getIdentity(participant)"
					class="flex flex-shrink-0 flex-row space-x-4"
				>
					<VideoCallVideo
						v-if="isUnfocused(participant, false)"
						:username="getIdentity(participant)"
						:participant="asParticipant(participant)"
						:size="getSizeUnfocusedScreens()"
						:is-self-view="false"
					/>
					<VideoCallScreenShare
						v-if="isUnfocused(participant, true) && isScreenShareEnabled(participant)"
						:username="getIdentity(participant)"
						:participant="asParticipant(participant)"
						:size="getSizeUnfocusedScreens()"
					/>
				</div>
			</div>
		</div>
		<div class="flex justify-center">
			<VideoCallVideo
				v-if="!focus[1]"
				:username="focus[0].identity"
				:participant="focus[0]"
				:size="getSizeFocusScreen()"
				:is-self-view="false"
			/>
			<VideoCallScreenShare
				v-else
				:username="focus[0].identity"
				:participant="focus[0]"
				:size="getSizeFocusScreen()"
			/>
		</div>
	</div>
	<div
		v-else
		ref="gridContainer"
		class="grid w-full justify-center"
		:style="gridStyle"
	>
		<template
			v-for="screen in visibleScreens"
			:key="screen.id"
		>
			<VideoCallVideo
				v-if="screen.type === 'video'"
				:username="getIdentity(screen.participant)"
				:participant="asParticipant(screen.participant)"
				:size="''"
				:is-self-view="false"
			/>
			<VideoCallScreenShare
				v-else
				:username="getIdentity(screen.participant)"
				:participant="asParticipant(screen.participant)"
				:size="''"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
	import VideoCallScreenShare from './VideoCallScreenShare.vue';
	import { type Participant } from 'livekit-client';
	import { computed, ref, watch } from 'vue';

	import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';

	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		remoteParticipants: unknown[];
	}>();
	const videoCall = useVideoCall();
	const focus = computed(() => videoCall.focus as [Participant | null, boolean]);
	const gridContainer = ref<HTMLDivElement | null>(null);
	const visibleScreenCount = 6;
	const totalRemoteStreams = computed<number>(() => {
		return props.remoteParticipants.reduce<number>((streams: number, participant) => {
			streams += 1;
			if (isScreenShareEnabled(participant)) {
				streams += 1;
			}
			return streams;
		}, 0);
	});

	const allScreens = computed(() => {
		let screens: Array<{ id: string; type: string; participant: unknown }> = [];
		props.remoteParticipants.forEach((participant) => {
			screens.push({
				id: `video-${getIdentity(participant)}`,
				type: 'video',
				participant,
			});
			if (isScreenShareEnabled(participant)) {
				screens.push({
					id: `screenShare-${getIdentity(participant)}`,
					type: 'screenShare',
					participant,
				});
			}
		});
		return screens;
	});

	// TODO see if this can be made without hardcoding.
	const gridLayout = computed(() => {
		const count = Math.min(allScreens.value.length, visibleScreenCount);
		if (count <= 1) return { cols: 1, rows: 1 };
		if (count <= 2) return { cols: 2, rows: 1 };
		if (count <= 4) return { cols: 2, rows: 2 };
		if (count <= 6) return { cols: 3, rows: 2 };
		return { cols: 3, rows: 3 };
	});

	const visibleScreens = computed(() => {
		return allScreens.value.slice(0, visibleScreenCount);
	});

	const gridStyle = computed(() => {
		return {
			gridTemplateColumns: `repeat(${gridLayout.value.cols}, 1fr)`,
			gridTemplateRows: `repeat(${gridLayout.value.rows}, 1fr)`,
			gridAutoRows: '1fr',
		};
	});

	watch(
		[props.remoteParticipants],
		() => {
			if (!focus.value[0]) return;

			const identityFocused = focus.value[0].identity;
			const focusedParticipantInCall = props.remoteParticipants.some((remote) => getIdentity(remote) === identityFocused);

			if (!focusedParticipantInCall) {
				videoCall.toggleFocus(null, false);
			}
		},
		{ deep: true },
	);

	function getSizeFocusScreen() {
		return 'w-10/12';
	}

	function getSizeUnfocusedScreens() {
		return 'w-[15vw]';
	}

	function asParticipant(participant: unknown): Participant {
		return participant as Participant;
	}

	function getIdentity(participant: unknown): string {
		const candidate = participant as { identity?: string };
		return candidate.identity ?? '';
	}

	function isScreenShareEnabled(participant: unknown): boolean {
		const candidate = participant as { isScreenShareEnabled?: boolean };
		return candidate.isScreenShareEnabled === true;
	}

	function isUnfocused(participant: unknown, screenShare: boolean) {
		return !(focus.value[0] === asParticipant(participant) && focus.value[1] === screenShare);
	}
</script>
