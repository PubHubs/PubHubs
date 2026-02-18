// Form Types

type InputType = string | number | boolean | undefined;
type FieldInputType = InputType | Array<InputType>;

type FieldOptionType = string | undefined;

type FieldOption = {
	label: string;
	value: FieldOptionType;
	icon?: string;
	avatar?: string;
};
type FieldOptions = Array<FieldOption | string>;
type LabeledFieldOptions = Array<FieldOption>;

type FieldSelection = Array<number>;

export { InputType, FieldInputType, FieldOptionType, FieldOption, LabeledFieldOptions, FieldOptions, FieldSelection };
