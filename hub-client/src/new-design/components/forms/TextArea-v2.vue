<template>
	<TextFieldV2 v-model="model" :name="name ?? slotDefault" :id="id" :placeholder="placeholder" :help="help" :validation="validation" type="textarea" :disabled="disabled"><slot></slot></TextFieldV2>
</template>

<script setup lang="ts">
	// Components
	import TextFieldV2 from './TextField-v2.vue';

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
