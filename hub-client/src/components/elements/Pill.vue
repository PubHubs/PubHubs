<template>
	<div class="bg-surface-elevated text-on-surface-dim py-050 text-label-tiny rounded-full px-200">
		{{ value }}
	</div>
</template>

<script setup lang="ts">
	// Props
	defineProps<{
		value: number | string;
	}>();
</script>
