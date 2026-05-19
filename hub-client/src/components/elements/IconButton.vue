<template>
	<Button
		:aria-label="ariaLabel"
		:disabled="disabled"
		:icon="icon"
		:mirrored="mirrored"
		:nofocus="nofocus"
		:size="size"
		:title="computedTitle"
		:variant="computedVariant"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// New design
	import Button, { type TVariant } from '@hub-client/components/elements/Button.vue';

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
			mirrored?: boolean;
		}>(),
		{
			ariaLabel: undefined,
			disabled: false,
			nofocus: false,
			size: 'base',
			title: undefined,
			variant: 'primary',
			mirrored: false,
		},
	);

	const computedVariant = computed(() => (props.variant + 'Icon') as TVariant);
	const computedTitle = computed(() => {
		if (props.title) return props.title;
		return props.icon;
	});
</script>
