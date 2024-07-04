<template>
	<div v-if="unreadMarker" class="text-center">
		<div class="inline-block bg-blue-light text-white text-sm font-medium text-center px-3.5 py-1.5 rounded-full m-auto">Unread Messages</div>
		<div class="bg-blue-light h-[1px] -mt-4"></div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRooms } from '@/store/store';

	const rooms = useRooms();

	const props = defineProps({
		currentEventId: {
			type: String,
			required: true,
		},
		currentUserId: {
			type: String,
			required: true,
		},
	});

	const unreadMarker = computed(() => {
		const readEventId = rooms.currentRoom?.getEventReadUpTo(props.currentUserId, true);
		if (rooms.unreadMessageNotification() > 0 && readEventId === props.currentEventId) return true;
		return false;
	});
</script>
