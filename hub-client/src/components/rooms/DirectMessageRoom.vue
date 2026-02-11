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
	import { Room, useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();

	// Props
	const props = defineProps<{
		room: Room;
		eventIdToScroll?: string;
	}>();

	// Initialize timeline and set current room when room changes
	// skipNavigation=true prevents URL change when viewing DM rooms in the DM page
	watch(
		() => props.room,
		(newRoom) => {
			if (newRoom) {
				rooms.changeRoom(newRoom.roomId, true);
				newRoom.initTimeline();
			}
		},
		{ immediate: true },
	);
</script>
