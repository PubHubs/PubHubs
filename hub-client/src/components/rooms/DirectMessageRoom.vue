<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<!-- Timeline -->
		<RoomTimeline v-if="room" :room="room" :event-id-to-scroll="eventIdToScroll" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { watch } from 'vue';

	// Components
	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';

	// Stores
	import { Room } from '@hub-client/stores/rooms';

	// Props
	const props = defineProps<{
		room: Room;
		eventIdToScroll?: string;
	}>();

	// Initialize timeline when room changes
	watch(
		() => props.room,
		(newRoom) => {
			if (newRoom) {
				newRoom.initTimeline();
			}
		},
		{ immediate: true },
	);
</script>
