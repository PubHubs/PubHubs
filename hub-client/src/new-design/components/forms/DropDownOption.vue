<template>
	<div
		class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim pt-050 cursor-pointer border-l px-200"
		:class="{ 'border-surface-elevated bg-surface-elevated': active, 'border-surface-on-surface-dim bg-on-surface-dim!': highlighted }"
		role="option"
	>
		<DropDownValue :value="value"></DropDownValue>
	</div>
</template>

<script setup lang="ts">
	import { FieldOption } from '@hub-client/models/validation/TFormOption';

	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			value: FieldOption | string;
			active: boolean;
			highlighted: boolean;
		}>(),
		{
			active: false,
			highlighted: false,
		},
	);
</script>
