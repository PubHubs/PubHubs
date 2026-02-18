/**
 * useValidation provides a framework for form validation.
 * It includes core validation functions that validate the schemas with the form input, validation rules, and error message generation.
 * Create a new schema for each form and try to reuse generic validation rules and error messages.
 */
// Packages
import { computed, ref } from 'vue';

// Models
import { FieldValidations, ValidationMessage, ValidationRule } from '@hub-client/models/validation/TValidate';

const validateFunctions: { [key: string]: Function } = {
	required: (value: string | any[]): boolean => {
		return Array.isArray(value) ? value.length > 0 : !!value;
	},

	minValue: (value: number, min: number): boolean => {
		return value >= min;
	},

	maxValue: (value: number, max: number): boolean => {
		return value <= max;
	},

	minLength: (value: string | any[], min: number): boolean => {
		if (value) return value.length >= min;
		return false;
	},

	maxLength: (value: string | any[], max: number): boolean => {
		if (value) return value.length <= max;
		return true;
	},

	isNumber: (value: any) => {
		return !isNaN(value);
	},
};

const validateMessageFunctions: { [key: string]: Function } = {
	required: (_: string, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.required', parameters: [keyTranslation] };
	},

	minLength: (value: string, min: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.min_length', parameters: [keyTranslation, min, value.length] };
	},

	maxLength: (value: string, max: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.max_length', parameters: [keyTranslation, max, value.length] };
	},

	maxItems: (value: any[], max: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.max_items', parameters: [keyTranslation, max, value.length] };
	},

	minValue: (value: number, min: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.min_value', parameters: [keyTranslation, min, value] };
	},

	maxValue: (value: number, max: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.max_value', parameters: [keyTranslation, max, value] };
	},

	isNumber: (_: number, keyTranslation: string): ValidationMessage => {
		return { translationKey: 'validation.is_number', parameters: [keyTranslation] };
	},
};

function useFieldValidation(name: string, model: any, validation?: FieldValidations) {
	const changed = ref(false);
	const required = ref(false);
	const rules: ValidationRule[] = [];

	if (validation) {
		const keys = Object.keys(validation);
		required.value = keys.includes('required');
		keys.forEach((key) => {
			let rule: ValidationRule;
			if (key === 'custom') {
				rule = validation[key] as ValidationRule;
			} else {
				rule = {
					validator: validateFunctions[key],
					args: [] as any[],
					message: validateMessageFunctions[key],
				} as ValidationRule;
				if (validation[key] && typeof validation[key] !== 'boolean') {
					rule.args = [validation[key]];
				}
			}
			rules.push(rule);
		});
	}

	// Computed
	const validateField = computed(() => {
		if (!changed.value && model.value !== undefined) {
			changed.value = true;
		}
		for (const rule of rules) {
			if (!rule.validator(model.value, ...(rule.args || []))) {
				// If message is a function we get the returned ValidationMessage from the function
				if (typeof rule.message === 'function') {
					return rule.message(model.value, ...(rule.args || []), name) as ValidationMessage;
				}
				return rule.message as ValidationMessage;
			}
		}
		return null;
	});

	const validated = computed(() => {
		return validateField.value === null || !changed.value;
	});

	return { validateField, validated, required };
}

export { useFieldValidation, validateFunctions, validateMessageFunctions };
