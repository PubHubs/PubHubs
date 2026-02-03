<template>
	<div>
		<slot :id="id" :validated="validated" :changed="changed" :required="required"></slot>

		<FieldInfoBox :info="info">
			<FieldHelperText v-if="props.help && !(!validated && changed)">{{ help }}</FieldHelperText>
			<FieldValidationError v-if="!validated && changed">{{ $t(validateField!.translationKey, validateField!.parameters) }}</FieldValidationError>
		</FieldInfoBox>
	</div>
</template>

<script setup lang="ts">
	// This is a wrapper component to make any custom made input field to a validated field
	//
	// Packages
	import { inject, onMounted, provide, ref, watch } from 'vue';

	// Composables
	import { useFieldValidation } from '@hub-client/composables/validation.composable';

	import FieldHelperText from '@hub-client/new-design/components/forms/FieldHelperText.vue';
	// New design
	import FieldInfoBox from '@hub-client/new-design/components/forms/FieldInfoBox.vue';
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			name?: string;
			label?: string;
			validation?: Object;
			help?: string;
			info?: string | boolean;
		}>(),
		{
			name: '',
			label: '',
			validation: undefined,
			help: '',
			info: false,
		},
	);

	// const changed = ref(false);
	const model = defineModel<any>();
	const originalValue = ref<any>(undefined);

	// Validation etc.
	const { id, fieldName, update, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.name, model, props.validation);

	onMounted(() => {
		// Keep original value
		originalValue.value = Object.assign({}, model);

		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField', () => {}) as Function;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
		}
	});

	watch(
		() => model,
		() => {
			changed.value = originalValue.value !== model;
		},
		{ deep: true },
	);

	provide('id', id);
	provide('required', required);
	provide('validated', validated);
	provide('changed', changed);
</script>
