/**
 *
 * This composable can be used in form input components. It consists of the basic parts every input should have and some interfaces for common types
 * - a value
 * - handling of basic events (change,submit,cancel)
 * - Option & Options types for select inputs
 *
 * Usage:
 *
 *      import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
 *
 *      // Need to give the events context to the composable (emit)
 *
 *      const emit = defineEmits(usedEvents);
 *      const { value, changed, submit, cancel } = useFormInputEvents(emit);
 *
 *      // If you need to set the value (according to a propperty of the component for example):
 *
 *      const emit = defineEmits(usedEvents);
 *      const { value, setValue, changed, submit, cancel } = useFormInputEvents(emit);
 *      setValue(props.value);
 *
 */

import { ref, PropType } from 'vue';

type InputType = string | number | boolean | undefined;

type OptionType = string | number;

interface Option {
	label: string;
	value: OptionType;
}

type Options = Array<PropType<Option>>;

// Types for FormObjectInput

interface FormObjectInputTemplate {
	key: string;
	label: string;
	type: string;
	options?: Options;
	default: InputType;
	// Used for textarea's.
	maxLength?: number;
}

enum FormInputType {
	Text = 'text',
	TextArea = 'textarea',
	CheckBox = 'checkbox',
	Select = 'select',
}

const usedEvents = ['update', 'update:modelValue', 'changed', 'cancel', 'submit'];

const useFormInputEvents = (emit: Function, set: InputType = '') => {
	const value = ref<InputType>(set);

	let options = [] as Options;

	const setValue = (set: InputType) => {
		value.value = set;
	};

	const setOptions = (set: Options) => {
		options = set;
	};

	const selectOption = (option: any) => {
		value.value = option.value;
	};

	const optionIsSelected = (option: Option) => {
		return JSON.stringify(value.value) === JSON.stringify(option.value);
	};

	const update = (set: InputType) => {
		if (typeof set === 'string') {
			set = set.replace(/^\n*/g, '');
		}
		value.value = set;
		changed();
	};

	const changed = () => {
		emit('changed', value.value);
		emit('update:modelValue', value.value);
	};

	const reset = () => {
		value.value = '';
	};

	const submit = () => {
		if (value.value !== undefined && value.value !== '') {
			emit('submit', value.value);
		}
		reset();
	};

	const cancel = () => {
		reset();
		emit('cancel');
	};

	return { value, setValue, options, setOptions, selectOption, optionIsSelected, update, changed, reset, submit, cancel };
};

export { type InputType, type Option, type Options, FormObjectInputTemplate, FormInputType, useFormInputEvents, usedEvents };
