// Packages
import { computed, getCurrentInstance, ref } from 'vue';

export type inputValidation = {
	required?: boolean;
	max_length?: number;
	min_length?: number;
	isNumber?: boolean;
	min?: number;
	max?: number;
	// Mandatory checks for allowing empty values
	// allow_empty_text: boolean;
	// allow_empty_number: boolean;
	// allow_empty_object: boolean;
};

export const defaultValidation = {};

const validateFunctions: { [key: string]: Function } = {
	required: (value: number | string, validation: inputValidation, changed: boolean = false) => {
		let v = false;
		if (!validation.required || !changed) {
			v = true;
		} else {
			v = value !== '';
		}
		return v;
	},

	min_length: (value: string, validation: inputValidation) => {
		return value.length >= validation.min_length!;
	},

	max_length: (value: string, validation: inputValidation) => {
		return value.length < validation.max_length!;
	},

	isNumber: (value: any, validation: inputValidation) => {
		return !isNaN(value);
	},

	min: (value: number, validation: inputValidation) => {
		return Number(value) >= validation.min!;
	},

	max: (value: number, validation: inputValidation) => {
		return Number(value) < validation.max!;
	},
};

export function useFormInput(model: any |undefined = undefined, validation: any | undefined = undefined) {
	const changed = ref(false);
	const error = ref('');
	const errorParam = ref(0);
	const hasFocus = ref(false);

	const setFocus = (state:boolean) => {
		hasFocus.value = state;
	}

	// For radio inputs
	const id = computed(() => {
		return 'id-' + getCurrentInstance()?.uid;
	});

	// For radio inputs
	const select = (value: string | number | boolean) => {
		if (model.value === value) {
			model.value = null;
		} else {
			model.value = value;
		}
		changed.value = true;
	};

	// For checkbox and toggle inputs
	const toggle = (disabled: boolean = false) => {
		if (!disabled) {
			model.value = !model.value;
			changed.value = true;
		}
	};

	const validated = computed(() => {
		let validated = true;
		if (model.value || changed.value) {
			changed.value = true;
			Object.keys(validation).every((key) => {
				const func = validateFunctions[key];
				validated = validated && func(model.value, validation, changed.value);
				error.value = 'forms.validation.' + key;
				errorParam.value = validation[key];
				return validated;
			});
		}
		if (validated) error.value = '';
		// console.info('validated',model.value, validation, validated);
		return validated;
	});

	return { id, setFocus, hasFocus, select, toggle, changed, validated, error, errorParam };
}
