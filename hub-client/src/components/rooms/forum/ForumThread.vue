<template>
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
		<RoomThread
			v-if="room?.getCurrentThreadId()"
			:room="room"
			:is-forum="true"
			:scroll-to-event-id="room.getCurrentEvent()?.eventId"
			@scrolled-to-event-id="room.setCurrentEvent(undefined)"
		></RoomThread>
		<InlineSpinner v-else></InlineSpinner>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import RoomThread from '../RoomThread.vue';
	import { onMounted, ref } from 'vue';

	// Components
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Object,
			required: true,
		},
	});

	const threadEvents = ref();

	onMounted(async () => {
		props.room.setCurrentThreadId(props.topic.eventId);
		threadEvents.value = await props.room.getCurrentThreadEvents();
	});
</script>
