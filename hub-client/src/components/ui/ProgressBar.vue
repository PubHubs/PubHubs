<template>
	<div class="flex h-4" role="progressbar">
		<div class="rounded-l-lg transition-[width]" :class="color + (percentage === 100 ? ' rounded-b-lg' : '')" :style="{ width: percentage + '%' }"></div>
		<div class="bg-surface-high rounded-r-lg transition-[width]" :class="{ 'rounded-b-lg': percentage === 0 }" :style="{ width: 100 - percentage + '%' }"></div>
	</div>
</template>

<script setup lang="ts">
	const props = defineProps({
		color: {
			type: String,
			default: 'bg-accent-primary',
		},
		percentage: {
			type: Number,
			required: true,
		},
	});
</script>
