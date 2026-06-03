<template>
	<RoomMessageBubble
		:event="event"
		:room="room"
		:show-actions="showActions"
		class="cursor-pointer"
		@click="$router.push({ name: 'room', params: { id: room.roomId, topicId: event.matrixEvent.event.event_id } })"
	>
		<template #extras>
			<ForumEventActions
				:event="event"
				:room="room"
			></ForumEventActions>
		</template>
		<template #bottom>
			<ForumEventBody :event="props.event"></ForumEventBody>
		</template>
	</RoomMessageBubble>
</template>

<script setup lang="ts">
	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumEventActions from '@hub-client/components/rooms/forum/ForumEventActions.vue';
	import ForumEventBody from '@hub-client/components/rooms/forum/ForumEventBody.vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	// Models
	import type Room from '@hub-client/models/rooms/Room';

	const props = withDefaults(
		defineProps<{
			event: TimelineEvent;
			room: Room;
			showActions: boolean;
		}>(),
		{
			showActions: true,
		},
	);
</script>
