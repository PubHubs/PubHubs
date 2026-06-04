<template>
	<ValidateField
		class="form-radiogroup"
		:help="help"
		role="radiogroup"
		:validation="validation"
	>
		<slot />
	</ValidateField>
</template>

<script lang="ts" setup>
	// Models
	// Components
	import ValidateField from '@hub-client/components/forms/elements/ValidateField.vue';

	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// Props
	withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			validation?: FieldValidations;
		}>(),
		{
			disabled: false,
			help: '',
			validation: undefined,
		},
	);
</script>
