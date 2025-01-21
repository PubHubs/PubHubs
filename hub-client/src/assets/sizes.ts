// NB: Set classes also in safeList of tailwind.config.js

const iconSizes: { [key: string]: string } = {
	xs: 'h-3 w-3',
	sm: 'h-4 w-4',
	base: 'h-6 w-6',
	md: 'h-7 w-7',
	lg: 'h-8 w-8',
	xl: 'h-12 w-12',
	'2xl': 'h-16 w-16',
	'3xl': 'h-20 w-20',
	'4xl': 'h-24 w-24',
};

const buttonSizes: { [key: string]: string } = {
	xs: 'py-0 px-1',
	sm: 'py-1 px-2',
	base: 'py-2 px-4',
	lg: 'py-3 px-6',
};

const headerSizes: { [key: string]: string } = {
	sm: 'max-h-16 md:max-h-24',
	base: 'max-h-24',
};

export { iconSizes, buttonSizes, headerSizes };
