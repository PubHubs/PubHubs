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
	// Models
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

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
