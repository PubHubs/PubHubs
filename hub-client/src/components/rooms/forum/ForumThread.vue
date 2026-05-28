<template>
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
		<RoomThread
			v-if="room?.getCurrentThreadId()"
			:room="room"
			:is-forum="true"
			:scroll-to-event-id="room.getCurrentEvent()?.eventId"
			@scrolled-to-event-id="room.setCurrentEvent(undefined)"
		></RoomThread>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted } from 'vue';

	// Components
	import RoomThread from '@hub-client/components/rooms/RoomThread.vue';

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
	});

	onMounted(async () => {
		props.room.setCurrentThreadId(props.event.event_id);
	});
</script>
