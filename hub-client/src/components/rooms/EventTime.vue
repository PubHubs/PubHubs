<template>
	<span class="text-xs font-normal"> {{ getDateTime() }}</span>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/composables/useTimeFormat';
	const { formatTimestamp, formattedTimeInformation } = useTimeFormat();

	const props = defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
		showDate: {
			type: Boolean,
			required: true,
		},
	});

	function getDateTime() {
		return props.showDate ? formattedTimeInformation(props.timestamp) : formatTimestamp(props.timestamp);
	}
</script>
