<template>
	<div class="flex items-center gap-1 break-words">
		<div class="overflow-hidden text-ellipsis">
			{{ body }}
		</div>
		<VideoCallButton
			v-if="!callEnded && !videoCall.call_active"
			:is-start-button="false"
			@click="JoinVideoCall()"
		></VideoCallButton>
	</div>
	<div v-if="duration">Duration: {{ duration }}</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref, watch } from 'vue';
	import { useRouter } from 'vue-router';

	import VideoCallButton from '@hub-client/components/ui/VideoCallButton.vue';

	import { PubHubsMgType } from '@hub-client/logic/core/events';

	import { type TMessageEvent, type TMessageEventContent, type TVideoCallMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	import { useRooms } from '@hub-client/stores/rooms';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		event: TMessageEvent<TVideoCallMessageEventContent>;
		roomId: string;
	}>();

	const router = useRouter();
	const rooms = useRooms();
	const videoCall = useVideoCall();
	const callEnded = ref(false);
	const hasEndCallReference = ref(false);
	const duration = ref<string | undefined>(undefined);
	const body = ref<string>(props.event.content.body ?? 'Loading...');
	const currentRoom = rooms.currentRoom;
	const timeLine = computed(() => (!hasEndCallReference.value ? currentRoom?.getTimeline() : null));

	async function JoinVideoCall() {
		await videoCall.joinCall();
		await router.push({ name: 'videocall' });
	}

	onMounted(() => checkHasCallEnded());

	watch(timeLine, () => {
		checkHasCallEnded();
	});

	async function checkHasCallEnded() {
		if (!currentRoom) return;

		const relatedEvents = currentRoom.getRelatedEvents(props.event.event_id).map((x) => x.matrixEvent);
		relatedEvents?.forEach((event) => {
			const newContent = event.event.content as TMessageEventContent;
			if (props.event.event_id !== event.event.event_id && newContent.msgtype === PubHubsMgType.VideoCallEnded) {
				callEnded.value = true;
				duration.value = calculateDuration(props.event.content.timestamp, newContent.timestamp);
				body.value = `Videocall ended`;
				hasEndCallReference.value = true;
				return;
			}
		});
		if (callEnded.value) return;

		const mostRecentVideoCallMessageOfUser = currentRoom.getLastVideoCallTimeLineEvent();
		const isOldMessage = props.event.event_id !== mostRecentVideoCallMessageOfUser?.event.event_id;

		if (isOldMessage) {
			callEnded.value = true;
			duration.value = 'Unknown';
			return;
		}

		// The group call state event may arrive after the room message.
		// Retry a few times to catch it.
		if (!currentRoom.isOngoingCall()) {
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				setTimeout(() => checkHasCallEnded(), 1000);
				return;
			}
			callEnded.value = true;
			duration.value = 'Unknown';
		} else {
			callEnded.value = false;
			retryCount = 0;
		}
	}

	let retryCount = 0;
	const MAX_RETRIES = 5;

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
