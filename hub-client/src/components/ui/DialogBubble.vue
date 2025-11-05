<template>
	<div class="bg-ph-background-2 z-10 h-20 w-40 max-w-0 overflow-hidden rounded-md transition-all duration-300 ease-in-out" :class="classObject" @click="closeBubble">
		<div class="relative flex h-full w-full items-center p-2">
			<Icon class="absolute right-1 top-1 w-fit hover:cursor-pointer" type="x" size="xs" />

			<p><slot></slot></p>
			<div class="absolute z-10">
				<div class="bg-ph-background-2" :class="{ triangle: showBubble }"></div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	const userHidBubble = ref(false);

	const props = defineProps({
		showBubble: Boolean,
	});

	const classObject = computed(() => ({
		'max-w-40 overflow-visible border': props.showBubble && !userHidBubble.value,
	}));

	function closeBubble() {
		userHidBubble.value = true;
	}
</script>

<style scoped>
	.triangle {
		position: absolute;
		bottom: -0.5rem;
		left: -0.9rem;
		width: 0.75rem;
		height: 0.75rem;
		transition: color 300ms ease-in-out;
		border-top: 1px solid currentColor;
		border-left: 1px solid currentColor;
		transform: rotate(-45deg);
	}
</style>
