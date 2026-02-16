<template>
	<div v-if="showMarker" class="text-label-tiny border-on-surface-dim text-on-surface rounded-base px-075 py-025 pt-050 bg-background mx-auto my-2 flex w-fit items-center justify-center gap-2 border uppercase">
		{{ $t('rooms.last_read_message') }}
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Props
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
		// Only show marker on the matching event
		if (!props.lastReadEventId || props.lastReadEventId !== props.currentEventId) {
			return false;
		}

		// Don't show marker if user is caught up
		const newestEventId = props.room.getTimelineNewestMessageEventId();
		if (newestEventId === props.lastReadEventId) {
			return false;
		}

		return true;
	});
</script>
