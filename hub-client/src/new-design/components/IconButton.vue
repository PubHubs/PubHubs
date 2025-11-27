<template>
	<Button :variant="computedVariant" :icon="icon" :disabled="disabled" :title="title" :size="size" :ariaLabel="ariaLabel"></Button>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Button from '@hub-client/new-design/components/Button.vue';
	import { TVariant } from '@hub-client/new-design/components/Button.vue';

	const props = withDefaults(
		defineProps<{
			variant?: TVariant;
			icon?: string;
			disabled?: boolean;
			title?: string;
			size?: 'base' | 'sm';
			ariaLabel?: string;
		}>(),
		{
			variant: 'primary',
			disabled: false,
			size: 'base',
		},
	);

	const computedVariant = computed(() => (props.variant + 'Icon') as TVariant);
</script>
