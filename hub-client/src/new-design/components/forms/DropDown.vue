<template>
	<div class="gap-075 mb-2 flex w-full flex-col items-start justify-start" v-click-outside="close">
		<Label :for="id" :required="required"><slot></slot></Label>

		<div class="bg-surface-low outline-offset-thin flex h-11 min-h-11 w-full items-center justify-start gap-2 rounded px-175 py-100 outline focus:ring-3" v-click-outside="close">
			<div class="grow cursor-pointer text-nowrap" @click.stop="toggle">
				<span v-if="model">{{ model }}</span>
				<span v-else class="text-surface-subtle">{{ placeholder }}</span>
			</div>
			<div class="cursor-pointer rounded-md bg-transparent" @click.stop="toggle">
				<Icon type="caret-down" size="md" weight="fill"></Icon>
			</div>
		</div>

		<div v-if="open" class="bg-surface-low outline-offset-thin flex grow flex-col overflow-hidden rounded outline">
			<DropDownOption v-for="(option, index) in options" :active="option === model" @click.stop="select(option)" class="-ml-[1px]">{{ option }}</DropDownOption>
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

	const open = ref(false);

	const select = (option: any) => {
		changed.value = true;
		if (model.value == option) {
			model.value = undefined;
		} else {
			model.value = option;
		}
		update();
		close();
	};

	const toggle = () => {
		open.value = !open.value;
	};

	const close = () => {
		open.value = false;
	};
</script>
