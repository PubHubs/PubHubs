<template>
	<TextField v-model="model" :name="name ?? slotDefault" :id="id" :placeholder="placeholder" :help="help" :validation="validation" type="textarea" :disabled="disabled">
		<slot></slot>
	</TextField>
</template>

<script setup lang="ts">
	// Models
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

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
			placeholder: '',
			validation: undefined,
		},
	);

	const model = defineModel<string>();

	const { slotDefault } = useFormInput(props, model);
</script>
