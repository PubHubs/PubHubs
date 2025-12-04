<template>
	<span class="text-label-small flex">
		<span>{{ formatted }}</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Composables
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

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
		timeForMsgPreview: {
			type: Boolean,
			default: false,
		},
	});

	const formatted = computed(() => {
		if (props.timeForMsgPreview) {
			return formatForPreview(props.timestamp);
		}
		return props.showDate ? formattedTimeInformation(props.timestamp) : formatTimestamp(props.timestamp);
	});

	function formatForPreview(timestamp: number): string {
		const date = new Date(timestamp);
		const today = new Date();

		const isToday = date.toDateString() === today.toDateString();
		return isToday ? formatTimestamp(timestamp) : formattedTimeInformation(timestamp);
	}
</script>
