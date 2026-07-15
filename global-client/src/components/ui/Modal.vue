<template>
	<div
		v-if="show"
		class="bg-surface-high absolute top-0 z-10 h-full w-[80px] opacity-80"
	/>
	<slot />
</template>

<script lang="ts" setup>
	defineProps({
		show: {
			type: Boolean,
			default: false,
		},
	});
</script>
