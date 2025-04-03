<template>
	<div v-if="props.scrollStatus && displayDate() !== ''" class="absolute top-6 z-40 flex w-full justify-end">
		<span class="rounded-full px-6 text-right text-on-surface-variant">{{ displayDate() }}</span>
	</div>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/logic/composables/useTimeFormat';
	import { useRooms } from '@/logic/store/rooms';
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
