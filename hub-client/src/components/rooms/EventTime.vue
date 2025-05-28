<template>
	<span class="flex items-center ~text-label-small-min/label-small-max">
		<span>{{ formatted }}</span>
	</span>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/logic/composables/useTimeFormat';
	import { computed } from 'vue';

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
