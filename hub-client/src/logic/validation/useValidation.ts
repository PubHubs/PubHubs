// Models
import { ValidationMessage, ValidationRule, ValidationSchema } from '@hub-client/models/validation/TValidate';

/**
 * useValidation provides a framework for form validation.
 * It includes core validation functions that validate the schemas with the form input, validation rules, and error message generation.
 * Create a new schema for each form and try to reuse generic validation rules and error messages.
 */
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

	function validateMaxValue(value: number, max: number): boolean {
		return value <= max;
	}
	function validateMaxLength(value: string | any[], max: number): boolean {
		return value.length <= max;
	}

	function validateRequired(value: string | any[]): boolean {
		return Array.isArray(value) ? value.length > 0 : !!value;
	}

	// Error messages

	function maxLengthMessage(value: string, max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_length', parameters: [keyTranslation, max, value.length] };
	}

	function RequiredMessage(_: string, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.required', parameters: [keyTranslation] };
	}

	function maxItemsMessage(value: any[], max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_items', parameters: [keyTranslation, max, value.length] };
	}
	function MaxValueMessage(value: number, max: number, keyTranslation: string): ValidationMessage {
		return { translationKey: 'validation.max_value', parameters: [keyTranslation, max, value] };
	}

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
			{ validator: validateRequired, args: ['admin.name'], message: RequiredMessage },
			{ validator: validateMaxLength, args: [roomSchemaConstants.maxNameLength, 'admin.name'], message: maxLengthMessage },
		],
		topic: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTopicLength, 'admin.topic'], message: maxLengthMessage }],
		description: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxDescriptionLength, 'admin.description'], message: maxLengthMessage }],
		attributes: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxAttributes, 'admin.secured_yivi_attributes'], message: maxItemsMessage }],
		acceptedMax: [{ validator: validateMaxValue, args: [roomSchemaConstants.maxValues, 'admin.value'], message: MaxValueMessage }],
		acceptedMin: [{ validator: validateRequired, args: ['admin.value'], message: RequiredMessage }],
		labelMin: [{ validator: validateRequired, args: ['admin.secured_attribute'], message: RequiredMessage }],
	};
	const editPublicRoomSchema: ValidationSchema = {
		name: [
			{ validator: validateRequired, args: ['admin.name'], message: RequiredMessage },
			{ validator: validateMaxLength, args: [roomSchemaConstants.maxNameLength, 'admin.name'], message: maxLengthMessage },
		],
		topic: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTopicLength, 'admin.topic'], message: maxLengthMessage }],
		type: [{ validator: validateMaxLength, args: [roomSchemaConstants.maxTypeLength, 'admin.room_type'], message: maxLengthMessage }],
	};
	return {
		validateBySchema,
		roomSchemaConstants,
		editSecuredRoomSchema,
		editPublicRoomSchema,
	};
}
export { useValidation };
