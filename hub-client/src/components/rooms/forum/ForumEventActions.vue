<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-1">
				<template v-if="event.latestThreadEventTimestamp > 0">
					<EventTime
						:timestamp="event.latestThreadEventTimestamp"
						:show-date="true"
					></EventTime>
					<EventTime
						:timestamp="event.latestThreadEventTimestamp"
						:show-date="false"
					></EventTime>
				</template>
				<Icon type="chat-circle-text" />
				<span>{{ nrOfReplies }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	// Components
	import EventTime from '@hub-client/components/rooms/EventTime.vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	// Models
	import type Room from '@hub-client/models/rooms/Room';

	// Store
	import { useRooms } from '@hub-client/stores/rooms';

	const props = withDefaults(
		defineProps<{
			event: TimelineEvent;
			room: Room;
		}>(),
		{},
	);

	const nrOfReplies = computed(() => {
		const rooms = useRooms();
		return rooms.threadLengths[props.room.roomId]?.[props.event.matrixEvent.getId()!] ?? 0;
	});
</script>
