<template>
	<div class="flex flex-row items-center justify-center">
		<div
			v-for="(bar, index) in bars"
			:key="index"
			:class="'m-1 h-4 w-4 transition ease-in-out' + (bar ? ' bg-accent-primary' : ' bg-surface-low')"
		/>
	</div>
</template>

<script setup lang="ts">
	import { ref, watch } from 'vue';

	const props = defineProps({
		volume: { type: Number, default: 0 },
	});

	const bars = ref([] as boolean[]);

	watch(
		() => props.volume,
		() => {
			// Watch for changes in the volume prop
			const barCount = Math.floor(props.volume * 5);
			bars.value = Array.from({ length: 10 }, (_, index) => index < barCount);
		},
	);
</script>
