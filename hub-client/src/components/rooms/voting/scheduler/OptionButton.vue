<template>
	<button
		class="flex h-300 w-300 min-w-300 items-center justify-center rounded-full text-xs hover:cursor-pointer"
		:class="calcClass"
		:disabled="disabled"
	>
		<slot></slot>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Props
	const props = withDefaults(
		defineProps<{
			color: string;
			colorwhen?: boolean;
			disabled?: boolean;
		}>(),
		{ colorwhen: true, disabled: false },
	);

	const calcClass = computed(() => {
		if (props.disabled && !props.colorwhen) return 'bg-surface-high text-white';
		if (props.colorwhen) return props.color;
		return props.color + ' opacity-25 hover:opacity-100';
	});
</script>
