<template>
	<span class="text-xs font-normal">{{ $d(new Date(timestamp), 'shorter') }}</span>
</template>

<script setup lang="ts">
	defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});
</script>
