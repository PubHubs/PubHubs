<template>
	<Button
		:aria-label="ariaLabel"
		:disabled="disabled"
		:icon="icon"
		:nofocus="nofocus"
		:size="size"
		:title="title"
		:variant="computedVariant"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// New design
	import Button, { type TVariant } from '@hub-client/new-design/components/Button.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			ariaLabel?: string;
			disabled?: boolean;
			icon: string;
			nofocus?: boolean;
			size?: 'base' | 'sm';
			title?: string;
			variant?: TVariant;
		}>(),
		{
			ariaLabel: undefined,
			disabled: false,
			nofocus: false,
			size: 'base',
			title: undefined,
			variant: 'primary',
		},
	);

	const computedVariant = computed(() => (props.variant + 'Icon') as TVariant);
</script>
