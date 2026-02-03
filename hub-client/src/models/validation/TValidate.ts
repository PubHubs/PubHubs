type ValidatorFn = (value: any, ...args: any[]) => boolean;

type ValidationMessage = {
	translationKey: string;
	parameters: any[];
};

type ValidationMessageFn = ValidationMessage | ((value: any, ...args: any[]) => ValidationMessage);

type ValidationRule = {
	validator: ValidatorFn;
	args?: any[];
	// message can be a ValidationMessage or fuction that returns a ValidationMessage
	message?: ValidationMessageFn;
};

type ValidationSchema = Record<string, ValidationRule[]>;

type FieldValidations = Record<string, any>;

export { ValidationRule, ValidationSchema, ValidationMessage, ValidationMessageFn, ValidatorFn, FieldValidations };
