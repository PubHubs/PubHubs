<template>
	<div
		class="bg-surface-elevated flex h-100"
		role="progressbar"
	>
		<div
			v-for="(percentage, index) in percentages"
			:key="index"
			class="transition-[width]"
			:class="colors[index]"
			:style="'width:' + percentage + '%'"
		></div>
	</div>
</template>

<script setup lang="ts">
	// Props
	defineProps<{
		percentages: number[];
	}>();

	const colors = ['bg-accent-green!', 'bg-accent-orange!', 'bg-accent-red!'];
</script>
