type ValidatorFn = (value: unknown, ...args: unknown[]) => boolean;

type ValidationMessage = {
	translationKey: string;
	parameters: unknown[];
};

type ValidationMessageFn = ValidationMessage | ((value: unknown, ...args: unknown[]) => ValidationMessage);

type ValidationRule = {
	validator: ValidatorFn;
	args?: unknown[];
	// message can be a ValidationMessage or fuction that returns a ValidationMessage
	message?: ValidationMessageFn;
};

type ValidationSchema = Record<string, ValidationRule[]>;

type FieldValidations = Record<string, unknown>;

export { ValidationRule, ValidationSchema, ValidationMessage, ValidationMessageFn, ValidatorFn, FieldValidations };
