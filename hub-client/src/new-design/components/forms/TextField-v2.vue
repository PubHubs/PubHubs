<template>
	<div class="gap-075 flex w-[320px] flex-col items-start justify-start">
		<!-- Label -->
		<label :for="id" class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start">
			<slot></slot>
			<span v-if="required" class="text-accent-red" aria-hidden="true">*</span>
		</label>

		<!-- Input element -->
		<textarea v-if="type==='textarea'"
			class="text-on-surface-dim bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
			v-model="model"
			:aria-invalid="!validated ? 'true' : undefined"
			:aria-required="required ? 'true' : undefined"
			:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
			:disabled="disabled"
			:name="name"
			:placeholder="placeholder"
		/>
		<input v-else
			class="text-on-surface-dim bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
			v-model="model"
			:aria-invalid="!validated ? 'true' : undefined"
			:aria-required="required ? 'true' : undefined"
			:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
			:disabled="disabled"
			:name="name"
			:placeholder="placeholder"
			:type="type"
		></input>

		<!-- Helper text -->
		<p v-if="props.help && validated" class="text-on-surface-dim text-label-small justify-end" aria-live="polite">
			{{ help }}
		</p>

		<!-- Validation error -->
		<p v-else-if="!validated" class="text-accent-red text-label-small flex items-center gap-100 text-pretty" role="alert" aria-live="assertive">
			<span class="ml-075">{{ $t(validateField!.translationKey, validateField!.parameters) }}</span>
		</p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { inject, onMounted, useAttrs } from 'vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Components

	const model = defineModel<string>();
	const attrs = useAttrs();

	// Props
	const props = withDefaults(
		defineProps<{
			name?: string;
			id?: string;
			placeholder?: string;
			help?: string;
			validation?: Object;
			type?: string;
			disabled?: boolean;
		}>(),
		{
			placeholder: '',
			help: '',
			validation: undefined,
			type: 'text',
			disabled: false,
		},
	);

	// Validation etc.
	const { id, slotDefault, fieldName, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(fieldName.value, model, props.validation);

	// Accessibility
	onMounted(() => {
		if (process.env.NODE_ENV !== 'production') {
			const hasVisibleLabel = !!slotDefault.value || !!props.name;
			const hasAriaLabel = !!(attrs as any)['aria-label'];
			if (!hasVisibleLabel && !hasAriaLabel) {
				console.warn('[TextInput-v2] Accessible name missing. Provide either a visible label (slot / name prop) or `aria-label` attribute.');
			}
		}

		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField') as Function;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
		}
	});
</script>
