<template>
	<div
		v-if="totalRemoteStreams === 0"
		class="flex h-full items-center justify-center"
	>
		<p class="text-on-surface-dim">{{ t('videocall.nobody_here') }}</p>
	</div>
	<div v-if="focus[0] && totalRemoteStreams > 1">
		<div class="mr-200 h-9/12 w-full overflow-x-scroll transition-all">
			<div class="flex flex-nowrap space-x-200">
				<div
					v-for="participant in props.remoteParticipants"
					:key="getIdentity(participant)"
					class="flex shrink-0 flex-row space-x-200"
				>
					<VideoCallVideo
						v-if="isUnfocused(participant, false)"
						:username="getIdentity(participant)"
						:participant="asParticipant(participant)"
						:size="unfocusedScreenSize"
						:is-self-view="false"
					/>
					<VideoCallScreenShare
						v-if="isUnfocused(participant, true) && isScreenShareEnabled(participant)"
						:username="getIdentity(participant)"
						:participant="asParticipant(participant)"
						:size="unfocusedScreenSize"
					/>
				</div>
			</div>
		</div>
		<div class="flex justify-center">
			<VideoCallVideo
				v-if="!focus[1]"
				:username="focus[0].identity"
				:participant="focus[0]"
				:size="focusScreenSize"
				:is-self-view="false"
			/>
			<VideoCallScreenShare
				v-else
				:username="focus[0].identity"
				:participant="focus[0]"
				:size="focusScreenSize"
			/>
		</div>
	</div>
	<div
		v-else
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
	import { type Participant } from 'livekit-client';
	import { computed, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import VideoCallScreenShare from '@hub-client/components/videocall/VideoCallScreenShare.vue';
	import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';

	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		remoteParticipants: unknown[];
	}>();
	const { t } = useI18n();
	const videoCall = useVideoCall();
	const focus = computed(() => videoCall.focus as [Participant | null, boolean]);
	const visibleScreenCount = 6;
	const totalRemoteStreams = computed(() =>
		props.remoteParticipants.reduce<number>((streams, participant) => streams + (isScreenShareEnabled(participant) ? 2 : 1), 0),
	);

	const allScreens = computed(() => {
		const screens: Array<{ id: string; type: 'video' | 'screenShare'; participant: unknown }> = [];
		props.remoteParticipants.forEach((participant) => {
			screens.push({ id: `video-${getIdentity(participant)}`, type: 'video', participant });
			if (isScreenShareEnabled(participant)) {
				screens.push({ id: `screenShare-${getIdentity(participant)}`, type: 'screenShare', participant });
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
		() => props.remoteParticipants,
		(participants) => {
			if (!focus.value[0]) return;

			const identityFocused = focus.value[0].identity;
			if (!participants.some((remote) => getIdentity(remote) === identityFocused)) {
				videoCall.toggleFocus(null, false);
			}
		},
		{ deep: true },
	);

	const focusScreenSize = 'w-10/12';
	const unfocusedScreenSize = 'w-[15vw]';

	// LiveKit participants have their class type stripped
	const asParticipant = (participant: unknown): Participant => participant as Participant;
	const getIdentity = (participant: unknown): string => (participant as { identity?: string }).identity ?? '';
	const isScreenShareEnabled = (participant: unknown): boolean => (participant as { isScreenShareEnabled?: boolean }).isScreenShareEnabled === true;

	const isUnfocused = (participant: unknown, screenShare: boolean) => !(focus.value[0] === asParticipant(participant) && focus.value[1] === screenShare);
</script>
