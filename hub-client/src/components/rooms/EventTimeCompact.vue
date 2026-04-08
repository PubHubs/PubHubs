<template>
	<span class="text-label-small flex items-center gap-1">
		<Icon type="clock" />
		<span>{{ formatTimestamp(timestamp) }}</span>
		<Icon type="calendar" />
		<span>{{ formattedTimeInformation(timestamp) }}</span>
	</span>
</template>

<script lang="ts" setup>
	// Composables
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});

	const { formatTimestamp, formattedTimeInformation } = useTimeFormat();
</script>
