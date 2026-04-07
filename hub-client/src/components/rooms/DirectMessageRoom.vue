<template>
	<div
		class="flex h-full w-full flex-col overflow-hidden"
		data-testid="dm-room"
	>
		<!-- Timeline -->
		<RoomTimeline
			v-if="room"
			:event-id-to-scroll="eventIdToScroll"
			:room="room"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { watch } from 'vue';

	// Components
	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';

	// Stores
	import { type Room, useRooms } from '@hub-client/stores/rooms';

	// Props
	const props = defineProps<{
		room: Room;
		eventIdToScroll?: string;
	}>();

	const rooms = useRooms();

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
