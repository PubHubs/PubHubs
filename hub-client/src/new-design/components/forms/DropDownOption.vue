<template>
	<div
		class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim pt-050 w-full cursor-pointer border-l px-200"
		:class="{ 'border-surface-elevated bg-surface-elevated': active, 'border-surface-on-surface-dim bg-on-surface-dim!': highlighted }"
		role="option"
	>
		<DropDownValue :value="value" />
	</div>
</template>

<script lang="ts" setup>
	// Models
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	// New design
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';

	// Props
	withDefaults(
		defineProps<{
			active?: boolean;
			highlighted?: boolean;
			value: FieldOption | string;
		}>(),
		{
			active: false,
			highlighted: false,
		},
	);
</script>
