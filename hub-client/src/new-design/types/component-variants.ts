export enum colorVariant {
	Primary = 'primary',
	Secundary = 'secundary',
	Tertiary = 'tertiary',
	Error = 'error',
	Disabled = 'disabled',
}

export const buttonBgColors: { [key: string]: string } = {
	[colorVariant.Primary]: 'bg-buttons-blue hover:opacity-75',
	[colorVariant.Secundary]: 'bg-surface-base hover:opacity-75',
	[colorVariant.Tertiary]: 'rounded outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim hover:opacity-75',
	[colorVariant.Error]: 'bg-buttons-red hover:opacity-75',
	[colorVariant.Disabled]: 'opacity-75 bg-surface-base-50/50 cursor-default',
};

export const buttonTextColors: { [key: string]: string } = {
	[colorVariant.Primary]: 'text-accent-on-blue',
	[colorVariant.Secundary]: 'text-surface-on-surface-dim',
	[colorVariant.Tertiary]: 'text-surface-on-surface-dim',
	[colorVariant.Error]: 'text-accent-on-red',
	[colorVariant.Disabled]: 'text-surface-on-surface-dim cursor-default',
};
