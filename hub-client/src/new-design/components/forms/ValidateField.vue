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

		<FieldInfoBox :info="info">
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
	import { computed, inject, onMounted, provide, ref, watch } from 'vue';

	// Composables
	import { useFieldValidation } from '@hub-client/composables/validation.composable';

	// Models
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

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

	const fieldRef = ref<HTMLElement>();
	const fixedWidth = ref(0);
	// const fieldClass = ref('');

	const model = defineModel<unknown>();
	const originalValue = ref<unknown>(undefined);

	const { id, fieldName, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(props.name, model, props.validation);

	// Lifecycle
	onMounted(() => {
		fixedWidth.value = fieldRef.value?.clientWidth ?? 0;

		originalValue.value = Object.assign({}, model);

		if (props.validation) {
			const addField = inject('addField', () => {}) as (...args: unknown[]) => unknown;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
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
		let c = 'max-w-[' + fixedWidth.value + 'px]'; // Max Width
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
