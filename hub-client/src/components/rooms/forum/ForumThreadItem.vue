<template>
	<RoomMessageBubble
		:event="event"
		:room="room"
		:show-actions="showActions"
		class="cursor-pointer"
		@click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: event.event_id } })"
	>
		<template #extras>
			<ForumTopicExtras
				:event="event"
				:room="room"
			></ForumTopicExtras>
		</template>
		<template #bottom>
			<ForumEventBody :event="event"></ForumEventBody>
		</template>
	</RoomMessageBubble>
</template>

<script setup lang="ts">
	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumEventBody from '@hub-client/components/rooms/forum/ForumEventBody.vue';
	import ForumTopicExtras from '@hub-client/components/rooms/forum/ForumTopicExtras.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		event: {
			type: Object,
			required: true,
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
