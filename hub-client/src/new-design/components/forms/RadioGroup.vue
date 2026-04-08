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
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// Components
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';

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
