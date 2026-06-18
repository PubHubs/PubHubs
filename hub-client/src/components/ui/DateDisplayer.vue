<template>
	<div
		v-if="props.scrollStatus && displayDate() !== ''"
		class="pointer-events-none fixed top-300 z-100 flex w-full justify-end"
	>
		<span class="text-on-surface-dim rounded-full px-300 text-right">{{ displayDate() }}</span>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

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
	const { formattedTimeInformation } = useTimeFormat();
	const rooms = useRooms();

	function displayDate(): string {
		if (!rooms.currentRoom?.hasMessages()) return '';
		return formattedTimeInformation(props.eventTimeStamp);
	}
</script>
