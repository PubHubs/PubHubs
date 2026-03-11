<template>
	<Button :variant="computedVariant" :icon="icon" :disabled="disabled" :title="title" :size="size" :ariaLabel="ariaLabel" :nofocus="nofocus"></Button>
</template>

<script setup lang="ts">
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
			disabled: false,
			nofocus: false,
			size: 'base',
			variant: 'primary',
		},
	);

	const computedVariant = computed(() => (props.variant + 'Icon') as TVariant);
</script>
