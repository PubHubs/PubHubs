<template>
	<div class="gap-050 flex items-center wrap-break-word">
		<div class="overflow-hidden text-ellipsis">
			{{ t(`videocall.state.${props.event.content.videocallstate}`) }}
		</div>
		<VideoCallButton
			v-if="!isThreadEvent && !callEnded && !inCall"
			:is-start-button="false"
			@click="JoinVideoCall()"
		></VideoCallButton>
	</div>
	<div v-if="props.event.content.videocallstate === VideocallStateType.Ended">{{ t('videocall.duration') }}: {{ duration }}</div>
</template>

<script setup lang="ts">
	import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	import VideoCallButton from '@hub-client/components/ui/VideoCallButton.vue';

	import { PubHubsMgType, VideocallStateType } from '@hub-client/logic/core/events';

	import { RelationType } from '@hub-client/models/constants';
	import { type TMessageEvent, type TVideoCallMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	import { useRooms } from '@hub-client/stores/rooms';
	import useVideoCall from '@hub-client/stores/videoCall';

	const props = defineProps<{
		event: TMessageEvent<TVideoCallMessageEventContent>;
		roomId: string;
	}>();

	const router = useRouter();
	const rooms = useRooms();
	const videoCall = useVideoCall();
	const { t } = useI18n();

	// Hide the join button for the call you are already sitting in, thread root included.
	const inCall = computed(() => !!videoCall.livekit_room);
	const callEnded = ref(false);
	const duration = ref<string | undefined>(undefined);
	const currentRoom = rooms.currentRoom;
	const rtcSession = currentRoom?.getMatrixRTCSession();

	watch(
		() => currentRoom?.relatedEventsRevision.count,
		() => {
			if (!isThreadEvent.value) checkHasCallEnded();
		},
	);

	const isThreadEvent = computed(() => props.event.content?.['m.relates_to']?.rel_type === RelationType.Thread);

	function onMemberShipsChanged() {
		if (!isThreadEvent.value) checkHasCallEnded();
	}

	async function JoinVideoCall() {
		// check if there is a current call
		if (!currentRoom) return;

		await router.push({ name: 'videocall' });
	}

	onMounted(() => {
		if (!isThreadEvent.value) {
			checkHasCallEnded();
			rtcSession?.on(MatrixRTCSessionEvent.MembershipsChanged, onMemberShipsChanged);
		}
	});

	onUnmounted(() => {
		if (!isThreadEvent.value) {
			rtcSession?.off(MatrixRTCSessionEvent.MembershipsChanged, onMemberShipsChanged);
		}
	});

	async function checkHasCallEnded() {
		if (!currentRoom) return;

		// catch all ended videocalls and calculate their duration
		const relatedEvents = currentRoom.getRelatedEvents(props.event.event_id).map((x) => x.matrixEvent);
		for (const event of relatedEvents) {
			const newContent = event.event.content as TVideoCallMessageEventContent;
			if (
				props.event.event_id !== event.event.event_id &&
				newContent.msgtype === PubHubsMgType.VideoCall &&
				newContent.videocallstate === VideocallStateType.Ended
			) {
				duration.value = calculateDuration(props.event.origin_server_ts, newContent.timestamp);
				callEnded.value = true;
				return; // need to return from the method, therefore the for-loop
			}
		}

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
