/**
 * useValidation provides a framework for form validation.
 * It includes core validation functions that validate the schemas with the form input, validation rules, and error message generation.
 * Create a new schema for each form and try to reuse generic validation rules and error messages.
 */
// Packages
import { computed, ref } from 'vue';

// Models
import { type FieldValidations, type ValidationMessage, type ValidationRule } from '@hub-client/models/validation/TValidate';

const validateFunctions: { [key: string]: (...args: unknown[]) => unknown } = {
	required: (value: unknown): boolean => {
		return Array.isArray(value) ? value.length > 0 : !!value;
	},

	minValue: (value: unknown, min: unknown): boolean => {
		return (value as number) >= (min as number);
	},

	maxValue: (value: unknown, max: unknown): boolean => {
		return (value as number) <= (max as number);
	},

	minLength: (value: unknown, min: unknown): boolean => {
		const v = value as string | unknown[];
		if (v) return v.length >= (min as number);
		return false;
	},

	maxLength: (value: unknown, max: unknown): boolean => {
		const v = value as string | unknown[];
		if (v) return v.length <= (max as number);
		return true;
	},

	isNumber: (value: unknown) => {
		return !isNaN(Number(value));
	},
};

const validateMessageFunctions: { [key: string]: (...args: unknown[]) => unknown } = {
	required: (_: unknown, keyTranslation: unknown): ValidationMessage => {
		return { translationKey: 'validation.required', parameters: [keyTranslation as string] };
	},

	minLength: (value: unknown, min: unknown, keyTranslation: unknown): ValidationMessage => {
		const v = value as string;
		return { translationKey: 'validation.min_length', parameters: [keyTranslation as string, min as number, v.length] };
	},

	maxLength: (value: unknown, max: unknown, keyTranslation: unknown): ValidationMessage => {
		const v = value as string;
		return { translationKey: 'validation.max_length', parameters: [keyTranslation as string, max as number, v.length] };
	},

	maxItems: (value: unknown, max: unknown, keyTranslation: unknown): ValidationMessage => {
		const v = value as unknown[];
		return { translationKey: 'validation.max_items', parameters: [keyTranslation as string, max as number, v.length] };
	},

	minValue: (value: unknown, min: unknown, keyTranslation: unknown): ValidationMessage => {
		return { translationKey: 'validation.min_value', parameters: [keyTranslation as string, min as number, value as number] };
	},

	maxValue: (value: unknown, max: unknown, keyTranslation: unknown): ValidationMessage => {
		return { translationKey: 'validation.max_value', parameters: [keyTranslation as string, max as number, value as number] };
	},

	isNumber: (_: unknown, keyTranslation: unknown): ValidationMessage => {
		return { translationKey: 'validation.is_number', parameters: [keyTranslation as string] };
	},
};

function useFieldValidation(name: string, model: { value: unknown }, validation?: FieldValidations) {
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
					args: [] as unknown[],
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
