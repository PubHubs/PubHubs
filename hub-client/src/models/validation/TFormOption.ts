// Types
type FieldInputType = any | Array<any>;

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
