// Types
type FieldInputType = string | number | boolean | undefined | Array<string | number | boolean>;

type FieldOptionType = string | undefined;

type FieldOption = {
	label: string;
	value: FieldOptionType;
	icon?: string;
	avatar?: string;
};

type FieldOptions = Array<FieldOption | string>;

type FieldSelection = Array<number>;

export { FieldInputType, FieldOptionType, FieldOption, FieldOptions, FieldSelection };
