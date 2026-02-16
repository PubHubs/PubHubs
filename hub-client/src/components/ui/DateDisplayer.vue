<template>
	<div v-if="props.scrollStatus && displayDate() !== ''" class="pointer-events-none fixed top-6 z-40 flex w-full justify-end">
		<span class="text-on-surface-variant rounded-full px-6 text-right">{{ displayDate() }}</span>
	</div>
</template>

<script setup lang="ts">
	// Components
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const { formattedTimeInformation } = useTimeFormat();
	const rooms = useRooms();

	const props = defineProps({
		eventTimeStamp: {
			type: Number,
			required: true,
		},
		scrollStatus: {
			type: Boolean,
			required: true,
		},
	});

	function displayDate(): string {
		if (!rooms.currentRoom?.hasMessages()) return '';
		return formattedTimeInformation(props.eventTimeStamp);
	}
</script>
