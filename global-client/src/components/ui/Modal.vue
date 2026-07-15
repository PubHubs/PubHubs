<template>
	<div
		v-if="show"
		class="bg-scrim/50 dark:bg-scrim/75 absolute top-0 z-10 h-full w-[80px]"
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
