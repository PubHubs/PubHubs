<template>
	<div class="gap-075 mb-100 flex w-full flex-col items-start justify-start">
		<Label :for="id" :required="required"><slot></slot></Label>

		<!-- Input element -->
		<div class="flex w-full items-center">
			<div class="flex-grow" :class="{ 'w-full': !showLength }">
				<textarea
					v-if="type === 'textarea'"
					class="bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
					v-model="model"
					:aria-invalid="!validated ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
					:disabled="disabled"
					:name="name"
					:placeholder="placeholder"
					@keypress="update()"
				/>
				<input
					v-else
					class="bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
					v-model="model"
					:aria-invalid="!validated ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
					:disabled="disabled"
					:name="name"
					:placeholder="placeholder"
					:type="type"
					@keypress="update()"
				/>
			</div>
			<div v-if="showLength" class="pl-2">
				<span>{{ modelLen }}</span>
				<template v-if="maxLen"> / {{ maxLen }} </template>
			</div>
		</div>

		<FieldHelperText v-if="(props.help && !changed) || validated">{{ help }}</FieldHelperText>

		<FieldValidationError v-else-if="!validated && changed">
			{{ $t(validateField!.translationKey, validateField!.parameters) }}
		</FieldValidationError>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, inject, onMounted, ref, useAttrs, watch } from 'vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import FieldHelperText from '@hub-client/new-design/components/forms/FieldHelperText.vue';
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const model = defineModel<string | number>();
	const attrs = useAttrs();
	const modelLen = ref(0);

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
			showLength?: boolean;
		}>(),
		{
			placeholder: '',
			help: '',
			validation: undefined,
			type: 'text',
			disabled: false,
			showLength: false,
		},
	);

	watch(model, () => {
		calculateLen();
	});

	// Validation etc.
	const { id, slotDefault, fieldName, update, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(fieldName.value, model, props.validation);

	onMounted(() => {
		// Accessibility
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

		calculateLen();
	});

	const maxLen = computed(() => {
		if (!props.validation) return false;
		if (!props.validation.maxLength) return false;
		return props.validation.maxLength;
	});

	const calculateLen = () => {
		if (typeof model.value === 'string') {
			modelLen.value = model.value.length;
		} else if (typeof model.value === 'number') {
			modelLen.value = model.value.toFixed().length;
		} else {
			modelLen.value = 0;
		}
	};
</script>
