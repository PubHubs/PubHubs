<template>
	<div v-if="showMarker" class="text-center">
		<div class="text-label bg-background m-auto inline-block rounded-full px-2 text-center font-medium">{{ $t('rooms.last_read_message') }}</div>
		<div class="bg-on-surface-disabled -mt-[12px] h-[1px]"></div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		currentEventId: {
			type: String,
			required: true,
		},
		lastReadEventId: {
			type: String,
			default: null,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	const showMarker = computed(() => {
		// Don't show marker if:
		if (!props.lastReadEventId || props.lastReadEventId !== props.currentEventId) {
			return false; // This is not the last read message
		}

		const newestEventId = props.room.getTimelineNewestMessageEventId();
		if (props.lastReadEventId === newestEventId) {
			return false; // The user is caught up
		}

		return true;
	});
</script>
