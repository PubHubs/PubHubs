<template>
	<div v-if="show" class="absolute top-0 z-10 h-full w-24 bg-surface-high opacity-80"></div>
	<slot></slot>
</template>

<script setup lang="ts">
	const props = defineProps({
		show: {
			type: Boolean,
			default: false,
		},
	});
</script>
