<template>
	<button class="h-5 w-5 min-w-5 rounded-full align-middle text-xs text-black" :class="calcClass" :disabled="disabled">
		<slot></slot>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

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
		return props.color + ' opacity-25';
	});
</script>
