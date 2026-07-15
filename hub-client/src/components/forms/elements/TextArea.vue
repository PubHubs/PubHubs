<template>
	<TextField
		:id="id"
		v-model="model"
		:auto-grow="autoGrow"
		:disabled="disabled"
		:help="help"
		:name="name ?? slotDefault"
		:placeholder="placeholder"
		:rows="rows"
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
			// Grow with the text instead of scrolling inside a fixed box
			autoGrow?: boolean;
			disabled?: boolean;
			help?: string;
			id?: string;
			name?: string;
			placeholder?: string;
			// The height it starts at, and with autoGrow shrinks back to
			rows?: number;
			validation?: FieldValidations;
		}>(),
		{
			autoGrow: false,
			disabled: false,
			help: '',
			id: undefined,
			name: undefined,
			placeholder: '',
			rows: undefined,
			validation: undefined,
		},
	);

	const model = defineModel<string>();

	const { slotDefault } = useFormInput(props, model);
</script>
