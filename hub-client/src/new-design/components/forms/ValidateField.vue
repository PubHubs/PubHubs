<template>
	<div>
		<Label v-if="label" :for="id" :required="required">{{ label }}</Label>

		<slot></slot>

		<FieldValidationError v-if="!validated && changed">
			{{ $t(validateField!.translationKey, validateField!.parameters) }}
		</FieldValidationError>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { inject, onMounted, ref, watch } from 'vue';

	// Composables
	import { useFieldValidation } from '@hub-client/composables/useValidation';

	// New design
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			validation: Object;
			label?: string;
		}>(),
		{
			label: '',
		},
	);

	const changed = ref(false);
	const model = defineModel<any>();
	const originalValue = ref<any>(undefined);

	// Validation etc.
	const { id, fieldName } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.label, model, props.validation);

	onMounted(() => {
		// Keep original value
		originalValue.value = Object.assign({}, model);

		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField') as Function;
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
</script>
