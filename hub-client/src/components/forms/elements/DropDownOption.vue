<template>
	<div
		class="hover:border-surface-on-surface-dim hover:bg-on-surface-dim text-on-surface flex min-h-500 w-full cursor-pointer items-center border-l px-200 py-100"
		:class="{ 'border-surface-elevated bg-surface-elevated': active, 'border-surface-on-surface-dim bg-on-surface-dim!': highlighted }"
		role="option"
	>
		<DropDownValue :value="value" />
	</div>
</template>

<script lang="ts" setup>
	// Components
	import DropDownValue from '@hub-client/components/forms/elements/DropDownValue.vue';

	// Models
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

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
