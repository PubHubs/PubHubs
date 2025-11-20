<template>
	<div v-if="show" class="bg-surface-high absolute top-0 z-10 h-full w-24 opacity-80"></div>
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
