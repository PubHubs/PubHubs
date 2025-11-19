<template>
	<span class="flex items-center gap-1 ~text-label-small-min/label-small-max">
		<Icon type="clock"></Icon>
		<span>{{ formatTimestamp(timestamp) }}</span>
		<Icon type="calendar"></Icon>
		<span>{{ formattedTimeInformation(timestamp) }}</span>
	</span>
</template>

<script setup lang="ts">
	// Composables
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	const { formatTimestamp, formattedTimeInformation } = useTimeFormat();

	const props = defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});
</script>
