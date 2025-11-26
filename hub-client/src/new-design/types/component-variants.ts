export enum iconSizeVariant {
	Small = 'sm',
	Base = 'base',
}

export const iconSize: { [key: string]: string } = {
	[iconSizeVariant.Small]: '16',
	[iconSizeVariant.Base]: '24',
};

export enum iconColorVariant {
	Primary = 'primary',
	Secundary = 'secundary',
	Disabled = 'disabled',
}

export const iconButtonColors: { [key: string]: string } = {
	[iconColorVariant.Primary]: 'text-button-blue cursor-pointer',
	[iconColorVariant.Secundary]: 'text-on-surface-dim cursor-pointer',
	[iconColorVariant.Disabled]: 'text-on-surface-dim cursor-default opacity-75',
};

export enum buttonColorVariant {
	Primary = 'primary',
	Secundary = 'secundary',
	Tertiary = 'tertiary',
	Error = 'error',
	Disabled = 'disabled',
}

export const buttonBgColors: { [key: string]: string } = {
	[buttonColorVariant.Primary]: 'bg-button-blue ring-accent-blue hover:opacity-75',
	[buttonColorVariant.Secundary]: 'bg-surface-base ring-button-blue hover:opacity-75',
	[buttonColorVariant.Tertiary]: 'rounded ring-button-blue outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim hover:opacity-75',
	[buttonColorVariant.Error]: 'bg-button-red ring-button-blue hover:opacity-75',
	[buttonColorVariant.Disabled]: 'rounded ring-button-blue outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim opacity-75 bg-surface-base-50/50 cursor-not-allowed!',
};

export const buttonTextColors: { [key: string]: string } = {
	[buttonColorVariant.Primary]: 'text-button-on-blue',
	[buttonColorVariant.Secundary]: 'text-surface-on-surface-dim',
	[buttonColorVariant.Tertiary]: 'text-surface-on-surface-dim',
	[buttonColorVariant.Error]: 'text-button-on-red',
	[buttonColorVariant.Disabled]: 'text-surface-on-surface-dim',
};
