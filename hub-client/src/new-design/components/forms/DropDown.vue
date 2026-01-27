<template>
	<div class="gap-075 mb-2 flex w-full flex-col items-start justify-start">
		<Label :for="id" :required="required"><slot></slot></Label>

		<div class="bg-surface-low relative flex w-full items-center rounded-md" v-click-outside="close">
			<select id="id" v-model="model" :disabled="props.disabled">
				<DropDownOption v-for="(option, index) in options" :active="index === 2">{{ option.label }}</DropDownOption>
			</select>

			<div class="absolute right-1 cursor-pointer rounded-md bg-transparent" @click="toggle">
				<Icon type="caret-down" size="md"></Icon>
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
	import { PropType, computed, inject, onMounted, ref, useAttrs, watch } from 'vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import DropDownOption from '@hub-client/new-design/components/forms/DropDownOption.vue';
	import FieldHelperText from '@hub-client/new-design/components/forms/FieldHelperText.vue';
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	// Composables
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const model = defineModel<string | number>();

	const props = withDefaults(
		defineProps<{
			options: PropType<any>;
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

	// Validation etc.
	const { id, slotDefault, fieldName, update, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(fieldName.value, model, props.validation);

	onMounted(() => {
		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField') as Function;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
		}
	});

	// const emit = defineEmits(usedEvents);
	// const { value: inputValue, setValue, setOptions, selectOption, optionIsSelected, changed, submit, cancel } = useFormInputEvents(emit);

	// setValue(props.value);
	// setOptions(props.options);
</script>
