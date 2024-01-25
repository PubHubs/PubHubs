<template>
	<div v-if="show" class="absolute h-screen w-20 sm:w-32 z-10 bg-gray-middle opacity-75 top-0"></div>
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
