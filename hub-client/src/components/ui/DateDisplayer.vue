<template>
	<div v-if="props.scrollStatus && displayDate() !== ''" class="absolute top-4 z-50 flex w-full justify-center">
		<span class="rounded-full bg-gray-middle px-2.5 text-center text-white-middle dark:bg-gray-lighter dark:text-gray-middle">{{ displayDate() }}</span>
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
