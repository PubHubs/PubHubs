<template>
	<Button :variant="computedVariant" :icon="icon" :disabled="disabled" :title="title" :size="size" :ariaLabel="ariaLabel" :nofocus="nofocus"></Button>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// New design
	import Button from '@hub-client/new-design/components/Button.vue';
	import { TVariant } from '@hub-client/new-design/components/Button.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			variant?: TVariant;
			icon?: string;
			disabled?: boolean;
			title?: string;
			size?: 'base' | 'sm';
			ariaLabel?: string;
			nofocus?: boolean;
		}>(),
		{
			variant: 'primary',
			disabled: false,
			size: 'base',
			nofocus: false,
		},
	);

	const computedVariant = computed(() => (props.variant + 'Icon') as TVariant);
</script>
