<template>
	<RoomMessageBubble
		:event="topic.event!.matrixEvent.event"
		:room="room"
		:show-actions="false"
		class="cursor-pointer"
		@click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })"
	>
		<template #extras>
			<ForumTopicExtras
				:topic="topic"
				:room="room"
				:can-reply="canReply"
				@reply="replyTo($event)"
			></ForumTopicExtras>
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
		canReply: {
			type: Boolean,
			default: true,
		},
	});

	const emit = defineEmits(['reply']);

	const replyTo = (eventId: string) => {
		// eslint-disable-next-line -- temp code
		console.info('replyTo', eventId);
		emit('reply', eventId);
	};
</script>
