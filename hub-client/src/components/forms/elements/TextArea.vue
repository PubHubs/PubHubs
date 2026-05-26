<template>
	<TextField
		:id="id"
		v-model="model"
		:disabled="disabled"
		:help="help"
		:name="name ?? slotDefault"
		:placeholder="placeholder"
		type="textarea"
		:validation="validation"
	>
		<slot />
	</TextField>
</template>

<script lang="ts" setup>
	// Components
	import TextField from '@hub-client/components/forms/elements/TextField.vue';

	// Composables
	import { useFormInput } from '@hub-client/composables/FormInput.composable';

	// Models
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			id?: string;
			name?: string;
			placeholder?: string;
			validation?: FieldValidations;
		}>(),
		{
			disabled: false,
			help: '',
			id: undefined,
			name: undefined,
			placeholder: '',
			validation: undefined,
		},
	);

	const model = defineModel<string>();

	const { slotDefault } = useFormInput(props, model);
</script>
