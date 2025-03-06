<template>
	<div v-if="unreadMarker" class="text-center">
		<div class="m-auto inline-block rounded-full bg-blue-light px-3.5 py-1.5 text-center text-sm font-medium text-white">{{ $t('rooms.unread_messages') }}</div>
		<div class="-mt-4 h-[1px] bg-blue-light"></div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRooms } from '@/logic/store/store';

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
