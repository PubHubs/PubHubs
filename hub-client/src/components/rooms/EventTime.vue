<template>
	<span class="flex items-center ~text-label-small-min/label-small-max"
		><span>{{ getDateTime() }}</span></span
	>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/logic/composables/useTimeFormat';
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
