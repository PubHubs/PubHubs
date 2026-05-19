<template>
	<span class="text-label-small flex items-center gap-1 text-nowrap">
		<Icon
			type="clock"
			size="sm"
		/>
		<span>{{ formatTimestamp(timestamp) }}</span>
		<Icon
			type="calendar"
			size="sm"
		/>
		<span>{{ formattedTimeInformation(timestamp) }}</span>
	</span>
</template>

<script lang="ts" setup>
	// Composables
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});

	const { formatTimestamp, formattedTimeInformation } = useTimeFormat();
</script>
