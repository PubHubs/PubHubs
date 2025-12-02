<template>
	<div class="gap-075 flex w-[320px] flex-col items-start justify-start">
		<!-- Label -->
		<label :for="inputId" class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start">
			<slot>{{ label }}</slot>
			<span v-if="required" class="text-accent-red" aria-hidden="true">*</span>
		</label>

		<!-- Input element -->
		<textarea
			class="text-on-surface-dim bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
			v-model="model"
			:aria-invalid="!validated ? 'true' : undefined"
			:aria-required="required ? 'true' : undefined"
			:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
			:disabled="disabled"
			:name="name"
			:placeholder="placeholder"
			:type="type"
		/>

		<!-- Helper text -->
		<p v-if="props.help && validated" class="text-on-surface-dim text-label-small justify-end" aria-live="polite">
			{{ help }}
		</p>

		<!-- Validation error -->
		<p v-else-if="validateField" class="text-accent-red text-label-small flex items-center gap-100 text-pretty" role="alert" aria-live="assertive">
			<span class="ml-075">{{ $t(validateField.translationKey, validateField.parameters) }}</span>
		</p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, useAttrs, useSlots } from 'vue';

	// Components
	import { useFieldValidation } from '@hub-client/composables/useValidation';

	const model = defineModel();
	const attrs = useAttrs();
	const slots = useSlots();

	// Props
	const props = withDefaults(
		defineProps<{
			modelValue?: string;
			label?: string;
			name?: string;
			id?: string;
			placeholder?: string;
			help?: string;
			validation?: Object;
			type?: string;
			disabled?: boolean;
		}>(),
		{
			modelValue: '',
			label: '',
			placeholder: '',
			help: '',
			validation: undefined,
			type: 'text',
			disabled: false,
		},
	);

	// Computed props
	const inputId = computed(() => props.id ?? props.name ?? slots.default!()[0].children?.toString() ?? '');
	const validationName = computed(() => props.name ?? slots.default!()[0].children?.toString() ?? '');

	// Validation
	const { validateField, validated, required } = useFieldValidation(validationName.value, model, props.validation);

	// Accessibility
	onMounted(() => {
		if (process.env.NODE_ENV !== 'production') {
			const hasVisibleLabel = !!slots.default || !!props.label;
			const hasAriaLabel = !!(attrs as any)['aria-label'];
			if (!hasVisibleLabel && !hasAriaLabel) {
				console.warn('[TextInput-v2] Accessible name missing. Provide either a visible label (slot / label prop) or `aria-label` attribute.');
			}
		}
	});
</script>
