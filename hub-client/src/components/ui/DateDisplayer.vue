<template>
	<div v-if="props.scrollStatus && displayDate() !== ''" class="fixed top-24 z-50">
		<span class="fixed right-1/3 px-2.5 bg-gray-middle text-white-middle dark:bg-gray-lighter dark:text-gray-middle text-center rounded-full">{{ displayDate() }}</span>
	</div>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/composables/useTimeFormat';
	import { useRooms } from '@/store/rooms';
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
