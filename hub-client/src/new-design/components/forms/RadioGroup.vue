<template>
	<ValidateField :help="help" :validation="validation" role="radiogroup" class="form-radiogroup">
		<slot></slot>
	</ValidateField>
</template>

<script setup lang="ts">
	// Models
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// Components
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';

	// Props
	const props = withDefaults(
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
