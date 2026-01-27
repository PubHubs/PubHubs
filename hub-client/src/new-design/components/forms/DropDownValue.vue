<template>
	<span class="inline-flex items-center justify-start gap-2">
		<Icon v-if="icon" :type="icon"></Icon>
		<span class="text-surface-on-surface justify-start text-nowrap">{{ label }}</span>
	</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			value: Object | String;
		}>(),
		{},
	);

	const label = computed(() => {
		if (props.value) {
			if (props.value.label) return props.value.label;
		}
		return props.value;
	});

	const icon = computed(() => {
		if (props.value) {
			if (props.value.icon) return props.value.icon;
		}
		return undefined;
	});
</script>
