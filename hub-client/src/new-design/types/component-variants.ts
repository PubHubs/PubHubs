export enum iconSizeVariant {
	Small = 'sm',
	Base = 'base',
}

export const iconSize: { [key: string]: string } = {
	[iconSizeVariant.Small] : '16',
	[iconSizeVariant.Base] : '24',
}

export enum iconColorVariant {
	Primary = 'primary',
	Secundary = 'secundary',
	Disabled = 'disabled',
}

export const iconButtonColors : { [key: string]: string } = {
	[iconColorVariant.Primary]: 'bg-buttons-blue text-accent-on-blue cursor-pointer',
	[iconColorVariant.Secundary]: 'bg-surface-base text-surface-on-surface-dim cursor-pointer',
	[iconColorVariant.Disabled]: 'bg-surface-base text-surface-on-surface-dim cursor-default',
}

export enum buttonColorVariant {
	Primary = 'primary',
	Secundary = 'secundary',
	Tertiary = 'tertiary',
	Error = 'error',
	Disabled = 'disabled',
}

export const buttonBgColors: { [key: string]: string } = {
	[buttonColorVariant.Primary]: 'bg-buttons-blue hover:opacity-75',
	[buttonColorVariant.Secundary]: 'bg-surface-base hover:opacity-75',
	[buttonColorVariant.Tertiary]: 'rounded outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim hover:opacity-75',
	[buttonColorVariant.Error]: 'bg-buttons-red hover:opacity-75',
	[buttonColorVariant.Disabled]: 'opacity-75 bg-surface-base-50/50 cursor-default',
};

export const buttonTextColors: { [key: string]: string } = {
	[buttonColorVariant.Primary]: 'text-accent-on-blue',
	[buttonColorVariant.Secundary]: 'text-surface-on-surface-dim',
	[buttonColorVariant.Tertiary]: 'text-surface-on-surface-dim',
	[buttonColorVariant.Error]: 'text-accent-on-red',
	[buttonColorVariant.Disabled]: 'text-surface-on-surface-dim cursor-default',
};
