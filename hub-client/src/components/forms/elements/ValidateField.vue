<template>
	<div
		ref="fieldRef"
		:class="fieldClass"
	>
		<slot
			:id="id"
			:changed="changed"
			:required="required"
			:validated="validated"
		/>

		<!-- Rendered whenever the field could ever show help, a counter, or an error, so the row's
		     height is reserved up front and appearing errors don't push the layout around. -->
		<FieldInfoBox
			v-if="props.help || props.info || props.validation"
			:info="info"
		>
			<FieldHelperText v-if="props.help && !(!validated && changed)">
				{{ help }}
			</FieldHelperText>
			<FieldValidationError v-if="!validated && changed">
				{{ $t(validateField!.translationKey, validateField!.parameters) }}
			</FieldValidationError>
		</FieldInfoBox>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, inject, onMounted, onUnmounted, provide, ref, watch } from 'vue';

	// Components
	import FieldHelperText from '@hub-client/components/forms/elements/FieldHelperText.vue';
	import FieldInfoBox from '@hub-client/components/forms/elements/FieldInfoBox.vue';
	import FieldValidationError from '@hub-client/components/forms/elements/FieldValidationError.vue';

	// Composables
	import { useFormInput } from '@hub-client/composables/FormInput.composable';
	import { useFieldValidation } from '@hub-client/composables/validation.composable';

	// Models
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

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

	const fieldRef = ref<HTMLElement>();
	const fixedWidth = ref(0);

	const model = defineModel<unknown>();
	const originalValue = ref<unknown>(undefined);

	const { id, fieldName, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.name, model, props.validation);

	const addField = inject('addField', () => {}) as (...args: unknown[]) => unknown;
	const removeField = inject('removeField', () => {}) as (...args: unknown[]) => unknown;

	// Lifecycle
	onMounted(() => {
		fixedWidth.value = fieldRef.value?.clientWidth ?? 0;

		originalValue.value = Object.assign({}, model);

		if (props.validation && typeof addField === 'function') {
			addField(id.value, fieldName.value, model, changed, validated);
		}
	});

	onUnmounted(() => {
		if (props.validation && typeof removeField === 'function') {
			removeField(id.value);
		}
	});

	watch(
		() => model,
		() => {
			changed.value = originalValue.value !== model.value;
		},
		{ deep: true },
	);

	const fieldClass = computed(() => {
		// The canonical field stack (label → control → helper/error) lives here so every field type
		// shares the same label-to-control spacing instead of each consumer supplying its own.
		let c = 'flex w-full flex-col items-start justify-start gap-075 max-w-[' + fixedWidth.value + 'px]';
		if (validated.value) {
			c += ' validated';
		}
		return c;
	});

	provide('id', id);
	provide('required', required);
	provide('validated', validated);
	provide('changed', changed);
</script>
