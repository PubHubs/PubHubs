<template>
	<div class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim pt-050 h-11 min-h-11 cursor-pointer border-l px-200" :class="{ 'border-surface-elevated bg-surface-elevated': active }">
		<DropDownValue :value="value"></DropDownValue>
	</div>
</template>

<script setup lang="ts">
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			value: Object | String;
			active: boolean;
		}>(),
		{
			active: false,
		},
	);
</script>
