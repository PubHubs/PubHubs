<template>
	<div class="gap-050 flex items-center wrap-break-word">
		<div class="overflow-hidden text-ellipsis">
			{{ body }}
		</div>
		<VideoCallButton
			v-if="!callEnded"
			:is-start-button="false"
			@click="JoinVideoCall()"
		></VideoCallButton>
	</div>
	<div v-if="duration">Duration: {{ duration }}</div>
</template>

<script setup lang="ts">
	import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRouter } from 'vue-router';

	import VideoCallButton from '@hub-client/components/ui/VideoCallButton.vue';

	import { PubHubsMgType } from '@hub-client/logic/core/events';

	import { type TMessageEvent, type TMessageEventContent, type TVideoCallMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	import { useRooms } from '@hub-client/stores/rooms';

	const props = defineProps<{
		event: TMessageEvent<TVideoCallMessageEventContent>;
		roomId: string;
	}>();

	const router = useRouter();
	const rooms = useRooms();
	const callEnded = ref(false);
	const duration = ref<string | undefined>(undefined);
	const body = computed(() => props.event.content?.body ?? '');
	const currentRoom = rooms.currentRoom;
	const rtcSession = currentRoom?.getMatrixRTCSession();

	watch(
		() => currentRoom?.relatedEventsRevision.count,
		() => checkHasCallEnded(),
	);

	function onMemberShipsChanged() {
		checkHasCallEnded();
	}

	async function JoinVideoCall() {
		// check if there is a current call
		if (!currentRoom) return;

		await router.push({ name: 'videocall' });
	}

	onMounted(() => {
		checkHasCallEnded();
		rtcSession?.on(MatrixRTCSessionEvent.MembershipsChanged, onMemberShipsChanged);
	});

	onUnmounted(() => {
		rtcSession?.off(MatrixRTCSessionEvent.MembershipsChanged, onMemberShipsChanged);
	});

	async function checkHasCallEnded() {
		if (!currentRoom) return;

		const relatedEvents = currentRoom.getRelatedEvents(props.event.event_id).map((x) => x.matrixEvent);
		relatedEvents?.forEach((event) => {
			const newContent = event.event.content as TMessageEventContent;
			if (props.event.event_id !== event.event.event_id && newContent.msgtype === PubHubsMgType.VideoCallEnded) {
				duration.value = calculateDuration(props.event.content?.timestamp ?? 0, newContent.timestamp);
				return;
			}
		});

		const mostRecentVideoCallMessage = currentRoom.getLastVideoCallTimeLineEvent();
		const isOldMessage = props.event.event_id !== mostRecentVideoCallMessage?.event.event_id;

		if (isOldMessage) {
			callEnded.value = true;
			if (!duration.value) duration.value = 'Unknown';
			return;
		}

		if (!currentRoom.hasActiveCall()) {
			callEnded.value = true;
			if (!duration.value) duration.value = 'Unknown';
		} else {
			callEnded.value = false;
		}
	}

	function calculateDuration(start: number, end: number): string {
		if (!start || !end) {
			return 'Unknown';
		}
		const duration = end - start;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.round((duration % 60000) / 1000);
		return (seconds === 60 ? minutes + 1 + ':00' : minutes + ' minutes, ' + (seconds < 10 ? '0' : '') + seconds) + ' seconds';
	}
</script>
