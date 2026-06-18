<template>
	<div
		class="bg-ph-background-2 z-10 h-800 w-2000 max-w-0 overflow-hidden rounded-md transition-all duration-300 ease-in-out"
		:class="classObject"
		@click="closeBubble"
	>
		<div class="relative flex h-full w-full items-center p-100">
			<Icon
				class="top-050 right-050 absolute w-fit hover:cursor-pointer"
				size="xs"
				type="x"
			/>

			<p><slot /></p>
			<div class="absolute z-10">
				<div
					class="bg-ph-background-2"
					:class="{ triangle: showBubble }"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const props = defineProps({
		showBubble: Boolean,
	});

	const userHidBubble = ref(false);

	const classObject = computed(() => ({
		'max-w-2000 overflow-visible border': props.showBubble && !userHidBubble.value,
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
