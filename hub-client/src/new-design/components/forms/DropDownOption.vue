<template>
	<div
		:value="value"
		class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim inline-flex h-11 min-h-11 cursor-pointer items-center justify-start gap-2 border-l px-200 py-100"
		:class="{ 'border-surface-elevated bg-surface-elevated': active }"
	>
		<Icon v-if="icon" :type="icon"></Icon>
		<span class="text-surface-on-surface justify-start text-nowrap">{{ label }}</span>
	</div>
</template>

<script setup lang="ts">
	import { computed, useSlots } from 'vue';

	import Icon from '@hub-client/new-design/components/Icon.vue';

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

	const json = computed(() => {
		let parsed = undefined;
		try {
			parsed = JSON.parse(value.value);
		} catch (error) {
			// return undefined;
		}
		return parsed;
	});

	const label = computed(() => {
		if (json.value) {
			if (json.value.label) return json.value.label;
		}
		return value.value;
	});

	const icon = computed(() => {
		if (json.value) {
			if (json.value.icon) return json.value.icon;
		}
		return undefined;
	});
</script>
