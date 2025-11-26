type ValidatorFn = (value: any, ...args: any[]) => boolean;

type ValidationMessage = {
	translationKey: string;
	parameters: any[];
};

type ValidationMessageFn = ValidationMessage | ((value: any, ...args: any[]) => ValidationMessage);

type ValidationRule = {
	validator: ValidatorFn;
	args?: any[];
	// message can both be a  ValidationMessage or fuction that returns a ValidationMessage
	message: ValidationMessageFn;
};

type ValidationSchema = Record<string, ValidationRule[]>;

export { ValidationRule, ValidationSchema, ValidationMessage, ValidationMessageFn, ValidatorFn };
