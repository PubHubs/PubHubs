// Models
import { ValidationMessage, ValidationMessageFn, ValidationRule, ValidationSchema, ValidatorFn, validationRuleTypes } from '@hub-client/models/validation/TValidate';
import { computed, ref } from 'vue';

/**
 * useValidation provides a framework for form validation.
 * It includes core validation functions that validate the schemas with the form input, validation rules, and error message generation.
 * Create a new schema for each form and try to reuse generic validation rules and error messages.
 */

const validateFunctions: { [key: string]: Function } = {

	required : (value: string | any[]): boolean => {
		return Array.isArray(value) ? value.length > 0 : !!value;
	},

	minValue : (value: number, min: number): boolean => {
		return value >= min;
	},

	maxValue : (value: number, max: number): boolean => {
		return value <= max;
	},

	minLength : (value: string | any[], min: number): boolean => {
		return value.length >= min;
	},

	maxLength : (value: string | any[], max: number): boolean => {
		return value.length <= max;
	},

	isNumber: (value: any) => {
		return !isNaN(value);
	},
};

const validateMessageFunctions: { [key:string]:Function} = {

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


}


function useFieldValidation(model:any, validation:{}) {

	const rules = [] as ValidationRule[];
	const keys = Object.keys(validation);
	if (keys.length>0) {
		// console.info('validation',validation);
		keys.forEach((key) => {
			const validator = validateFunctions[key];
			const args = validation[key] ? [validation[key]]: undefined;
			const message = validateMessageFunctions[key];
			// console.info('add rule',key,validator,args,message);
			rules.push({
				validator:validator as ValidatorFn,
				args:args,
				message:message as ValidationMessageFn,
			});
		});
		// console.info('rules',validation,rules);
	}

	const validateField = computed(() => {
		console.info('validateField',model.value,rules);
		for (const rule of rules) {
			if (!rule.validator(model.value, ...(rule.args || []))) {
				// If message is a function we get the returned ValidationMessage from the function
				if (typeof rule.message === 'function') {
					return rule.message(model.value, ...(rule.args || []));
				}
				// The ValidationMessage is returned directly if message is not a function
				return rule.message;
			}
		}
		return null;
	});

	const validated = computed(()=> {
		return validateField.value === null;
	});


	return { validateField, validated }
}

function useValidation() {

	// Validation Core

	function validateField(value: any, rules: ValidationRule[]): ValidationMessage | null {
		for (const rule of rules) {
			if (!rule.validator(value, ...(rule.args || []))) {
				// If message is a function we get the returned ValidationMessage from the function
				if (typeof rule.message === 'function') {
					return rule.message(value, ...(rule.args || []));
				}
				// The ValidationMessage is returned directly if message is not a function
				return rule.message;
			}
		}
		return null;
	}

	function validateBySchema(values: Record<string, any>, schema: ValidationSchema): Record<string, ValidationMessage> | null {
		const errors: Record<string, ValidationMessage> = {};
		for (const key in schema) {
			const msg = validateField(values[key], schema[key]);
			if (msg) errors[key] = msg;
		}
		return Object.keys(errors).length ? errors : null;
	}

	// Validation rules

	function validateRequired(value: string | any[]): boolean {
		return Array.isArray(value) ? value.length > 0 : !!value;
	}

	function validateMinValue(value: number, min: number): boolean {
		return value >= min;
	}

	function validateMaxValue(value: number, max: number): boolean {
		return value <= max;
	}

	function validateMinLength(value: string | any[], min: number): boolean {
		return value.length >= min;
	}

	function validateMaxLength(value: string | any[], max: number): boolean {
		return value.length <= max;
	}

	// Error messages

	function minLengthMessage(value: string, min: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.min_length', parameters: [keyTranslation, min, value.length] };
	}

	function maxLengthMessage(value: string, max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_length', parameters: [keyTranslation, max, value.length] };
	}

	function requiredMessage(_: string, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.required', parameters: [keyTranslation] };
	}

	function maxItemsMessage(value: any[], max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_items', parameters: [keyTranslation, max, value.length] };
	}

	function minValueMessage(value: number, min: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.min_value', parameters: [keyTranslation, min, value] };
	}

	function maxValueMessage(value: number, max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_value', parameters: [keyTranslation, max, value] };
	}

	// Constants for Rooms

	const roomSchemaConstants = {
		maxNameLength: 100,
		maxTopicLength: 100,
		maxDescriptionLength: 100,
		maxAttributes: 12,
		maxValues: 400,
		maxTypeLength: 100,
	};

	// Customizable validation schema for each form that needs validation

	const editSecuredRoomSchema: ValidationSchema = {
		name: [
			{ validator: validateRequired, args: ['admin.name'], message: requiredMessage },
			{ validator: validateMaxLength, args: [roomSchemaConstants.maxNameLength, 'admin.name'], message: maxLengthMessage },
		],
		topic: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTopicLength, 'admin.topic'], message: maxLengthMessage }],
		description: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxDescriptionLength, 'admin.description'], message: maxLengthMessage }],
		attributes: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxAttributes, 'admin.secured_yivi_attributes'], message: maxItemsMessage }],
		acceptedMax: [{ validator: validateMaxValue, args: [roomSchemaConstants.maxValues, 'admin.value'], message: maxValueMessage }],

		acceptedMin: [{ validator: validateRequired, args: ['admin.value'], message: requiredMessage }],
		labelMin: [{ validator: validateRequired, args: ['admin.secured_attribute'], message: requiredMessage }],
	};

	const editPublicRoomSchema: ValidationSchema = {
		name: [
			{ validator: validateRequired, args: ['admin.name'], message: requiredMessage },
			{ validator: validateMaxLength, args: [roomSchemaConstants.maxNameLength, 'admin.name'], message: maxLengthMessage },

		],
		topic: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTopicLength, 'admin.topic'], message: maxLengthMessage }],
		type: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTypeLength, 'admin.room_type'], message: maxLengthMessage }],
	};


	return {
		validateField,
		validateBySchema,
		roomSchemaConstants,
		editSecuredRoomSchema,
		editPublicRoomSchema,
	};
}
export { useFieldValidation, useValidation, validationRuleTypes };
