<template>
	<div class="flex h-4 overflow-hidden rounded-lg" role="progressbar">
		<div v-for="(percentage, index) in percentages" :key="index" class="transition-[width]" :class="colors[index]" :style="'width:' + percentage + '%'"></div>
	</div>
</template>

<script setup lang="ts">
	const colors = ['bg-accent-lime', 'bg-accent-orange', 'bg-accent-red'];

	defineProps<{
		percentages: number[];
	}>();
</script>
