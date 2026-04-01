<template>
	<RoomMessageBubble :event="topic.event!.matrixEvent.event" :room="room" :showActions="false" @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" class="cursor-pointer">
		<template #extras>
			<ForumTopicExtras :topic="topic" :room="room" :can_reply="can_reply"></ForumTopicExtras>
		</template>
		<template #bottom>
			<ForumBody :topic="topic"></ForumBody>
		</template>
	</RoomMessageBubble>
	<!-- <ThreadItem @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" :topic="topic" :room="room" class="my-4" /> -->
</template>

<script setup lang="ts">
	// Packages
	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumBody from '@hub-client/components/rooms/forum/ForumBody.vue';
	import ForumTopicExtras from '@hub-client/components/rooms/forum/ForumTopicExtras.vue';
	// Stores
	import ThreadItem from '@hub-client/components/rooms/forum/ThreadItem.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
		can_reply: {
			type: Boolean,
			default: true,
		},
	});
</script>
