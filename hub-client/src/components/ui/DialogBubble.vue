<template>
	<div class="rounded-md w-40 h-20 z-10 bg-ph-background-2 overflow-hidden max-w-0 transition-all ease-in-out duration-300" :class="classObject" @click="closeBubble">
		<div class="relative p-2 h-full w-full flex items-center">
			<Icon class="absolute top-1 right-1 w-fit hover:cursor-pointer" type="close" size="xs"></Icon>

			<p><slot></slot></p>
			<div class="absolute z-10">
				<div class="bg-ph-background-2" :class="{ triangle: showBubble }"></div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
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

<style>
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
