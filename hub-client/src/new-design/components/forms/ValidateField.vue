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
	// Packages
	import { inject, onMounted, provide, ref, watch } from 'vue';

	// Composables
	import { useFieldValidation } from '@hub-client/composables/validation.composable';

	// Models
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import FieldHelperText from '@hub-client/new-design/components/forms/FieldHelperText.vue';
	import FieldInfoBox from '@hub-client/new-design/components/forms/FieldInfoBox.vue';
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			help?: string;
			info?: string | boolean;
			label?: string;
			name?: string;
			validation?: FieldValidations;
		}>(),
		{
			help: '',
			info: false,
			label: '',
			name: '',
			validation: undefined,
		},
	);

	const model = defineModel<any>();
	const originalValue = ref<any>(undefined);

	const { id, fieldName, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.name, model, props.validation);

	// Lifecycle
	onMounted(() => {
		originalValue.value = Object.assign({}, model);

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
