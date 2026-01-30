// Types
type FieldInputType = any | Array<any>;

type FieldOptionType = string | undefined;

interface FieldOption {
	label: string;
	value: FieldOptionType;
	icon?: string;
	avatar?: string;
}

type FieldOptions = Array<FieldOption | String>;

type FieldSelection = Array<number>;

export { FieldInputType, FieldOptionType, FieldOption, FieldOptions, FieldSelection };
