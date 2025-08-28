<template>
	<div class="flex h-4" role="progressbar">
		<div class="rounded-l-lg bg-accent-primary transition-[width]" :class="{ 'rounded-b-lg': percentage === 100 }" :style="{ width: percentage + '%' }"></div>
		<div class="rounded-r-lg bg-surface-high transition-[width]" :class="{ 'rounded-b-lg': percentage === 0 }" :style="{ width: 100 - percentage + '%' }"></div>
	</div>
</template>

<script setup lang="ts">
	defineProps<{
		percentage: number;
	}>();
</script>
