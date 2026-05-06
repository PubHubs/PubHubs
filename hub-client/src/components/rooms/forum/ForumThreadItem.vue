<template>
	<RoomMessageBubble
		:event="event.event.matrixEvent.event"
		:room="room"
		:show-actions="showActions"
		class="cursor-pointer"
		@click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: event.event.matrixEvent.event.event_id } })"
	>
		<template #extras>
			<ForumEventActions
				:event="event"
				:room="room"
			></ForumEventActions>
		</template>
		<template #bottom>
			<ForumEventBody :event="event.event.matrixEvent.event"></ForumEventBody>
		</template>
	</RoomMessageBubble>
</template>

<script setup lang="ts">
	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumEventActions from '@hub-client/components/rooms/forum/ForumEventActions.vue';
	import ForumEventBody from '@hub-client/components/rooms/forum/ForumEventBody.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
		lastTimestamp: {
			type: Number,
			default: 0,
		},
		room: {
			type: Room,
			required: true,
		},
		showActions: {
			type: Boolean,
			default: true,
		},
	});
</script>
