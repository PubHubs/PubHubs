type ValidatorFn = (value: any, ...args: any[]) => boolean;

type ValidationMessage = {
	translationKey: string;
	parameters: any[];
};

type ValidationMessageFn = ValidationMessage | ((value: any, ...args: any[]) => ValidationMessage);

type ValidationRule = {
	// validator can both a standard validation type (string) or a ValidatorFn function
	validator: ValidatorFn | string;
	args?: any[];
	// message can be undefined (in case of a standard validation type), a ValidationMessage or fuction that returns a ValidationMessage
	message?: ValidationMessageFn;
};

type ValidationSchema = Record<string, ValidationRule[]>;

export { ValidationRule, ValidationSchema, ValidationMessage, ValidationMessageFn, ValidatorFn };
