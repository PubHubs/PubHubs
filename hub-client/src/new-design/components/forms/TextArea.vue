<template>
	<TextField v-model="model" :name="name ?? slotDefault" :id="id" :placeholder="placeholder" :help="help" :validation="validation" type="textarea" :disabled="disabled"><slot></slot></TextField>
</template>

<script setup lang="ts">
	// Components
	import TextField from './TextField.vue';

	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const model = defineModel<string>();

	// Props
	const props = withDefaults(
		defineProps<{
			name?: string;
			id?: string;
			placeholder?: string;
			help?: string;
			validation?: Object;
			disabled?: boolean;
		}>(),
		{
			placeholder: '',
			help: '',
			validation: undefined,
			disabled: false,
		},
	);

	const { slotDefault } = useFormInput(props, model);
</script>
