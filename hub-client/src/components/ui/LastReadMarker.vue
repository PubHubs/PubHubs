<template>
	<div v-if="showMarker" class="text-center">
		<div class="text-label m-auto inline-block rounded-full text-center font-medium">{{ $t('rooms.last_read_message') }}</div>
		<div class="bg-accent-secondary -mt-4 h-[2px]"></div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Composables
	import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		currentEventId: {
			type: String,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	const { getLastReadMessage } = useLastReadMessages();

	const showMarker = computed(() => {
		const lastReadEventId = getLastReadMessage(props.room.roomId);

		// Don't show marker if:
		// 1. This is not the last read message, OR
		// 2. This IS the last read message BUT it's also the newest message (user is caught up)
		if (lastReadEventId !== props.currentEventId) {
			return false;
		}

		const newestEventId = props.room.getTimelineNewestMessageEventId();
		if (lastReadEventId === newestEventId) {
			return false; // Don't show marker if user is caught up
		}

		return true;
	});
</script>
