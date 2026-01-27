<template>
	<div
		:value="value"
		class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim inline-flex h-11 min-h-11 cursor-pointer items-center justify-start gap-2 border-l px-200 py-100"
		:class="{ 'border-surface-elevated bg-surface-elevated': active }"
	>
		<span class="text-surface-on-surface justify-start text-nowrap"><slot></slot></span>
	</div>
</template>

<script setup lang="ts">
	import { computed, useSlots } from 'vue';

	// Props
	const props = withDefaults(
		defineProps<{
			active: boolean;
		}>(),
		{
			active: false,
		},
	);

	const value = computed(() => {
		const slots = useSlots();
		if (slots.default) {
			return slots.default()[0].children?.toString() as string;
		}
		return '';
	});
</script>
