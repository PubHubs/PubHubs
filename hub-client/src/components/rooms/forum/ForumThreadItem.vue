<template>
	<RoomMessageBubble :event="topic.event!.matrixEvent.event" :room="room" :showActions="false" @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" class="cursor-pointer">
		<template #extras>
			<ForumTopicExtras :topic="topic" :room="room" :actions="false"></ForumTopicExtras>
		</template>
		<template #bottom>
			<ForumBody :topic="topic"></ForumBody>
		</template>
	</RoomMessageBubble>
	<!-- <ThreadItem @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" :topic="topic" :room="room" class="my-4" /> -->
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumBody from '@hub-client/components/rooms/forum/ForumBody.vue';
	import ForumTopicExtras from '@hub-client/components/rooms/forum/ForumTopicExtras.vue';
	import ThreadItem from '@hub-client/components/rooms/forum/ThreadItem.vue';

	import Room from '@hub-client/models/rooms/Room';

	const nrOfReplies = ref(0);

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	onMounted(async () => {
		props.room?.setCurrentThreadId(props.topic.eventId);
		nrOfReplies.value = props.room?.getCurrentThreadLength() ?? 0;
		// console.info('ThreadItem.onMounted', props.topic.eventId, nrOfReplies.value);
	});
</script>
