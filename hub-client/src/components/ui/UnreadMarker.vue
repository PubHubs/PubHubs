<template>
	<div v-if="unreadMarker" class="text-center">
		<div class="text-label m-auto inline-block rounded-full text-center font-medium">{{ $t('rooms.unread_messages') }}</div>
		<div class="bg-primary-accent text-on-primary-accent -mt-4 h-[1px]"></div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

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
