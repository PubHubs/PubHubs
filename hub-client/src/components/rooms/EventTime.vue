<template>
	<span class="text-xs font-normal"> {{ getDateTime() }}</span>
</template>

<script setup lang="ts">
	import { useTimeFormat } from '@/composables/useTimeFormat';
	const { formatTimestamp } = useTimeFormat();

	const props = defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});

	function getDateTime() {
		return formatTimestamp(props.timestamp);
	}
</script>
