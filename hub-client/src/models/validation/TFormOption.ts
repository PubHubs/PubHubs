// Form Types

type InputType = string | number | boolean | undefined;
type MultipleInputType = Array<InputType>;
type FieldInputType = InputType | Array<InputType>;

type FieldOptionType = string | undefined;

type FieldOption = {
	label: string;
	value: FieldOptionType;
	icon?: string;
	avatar?: string;
	data?: unknown; // Optional data before transformed for form elements
};
type FieldOptions = Array<FieldOption | string>;
type LabeledFieldOptions = Array<FieldOption>;

type FieldSelection = Array<number>;

export { InputType, MultipleInputType, FieldInputType, FieldOptionType, FieldOption, LabeledFieldOptions, FieldOptions, FieldSelection };
