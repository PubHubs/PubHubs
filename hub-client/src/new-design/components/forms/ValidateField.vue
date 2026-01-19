<template>
	<div class="gap-075 mb-2 flex w-full flex-col items-start justify-start">
		<!-- Label -->
		<label v-if="label" :for="id" class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start">
			{{ label }}
			<span v-if="required" class="text-accent-red" aria-hidden="true">*</span>
		</label>

		<slot></slot>

		<!-- Validation error -->
		<p v-if="!validated" class="text-accent-red text-label-small flex items-center gap-100 text-pretty" role="alert" aria-live="assertive">
			<span class="ml-075">{{ $t(validateField!.translationKey, validateField!.parameters) }}</span>
		</p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { inject, onMounted } from 'vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const model = defineModel<string | number>();

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

	// Validation etc.
	const { id, fieldName, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.label, model, props.validation);

	onMounted(() => {
		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField') as Function;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
		}
	});
</script>
