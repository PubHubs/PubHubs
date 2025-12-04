const iconSizes: { [key: string]: number } = {
	xs: 8,
	sm: 12,
	base: 16,
	md: 20,
	lg: 24,
	xl: 32,
	'2xl': 48,
	'3xl': 68,
};

const buttonSizes: { [key: string]: string } = {
	xs: 'py-0 px-2 h-6',
	sm: 'py-1 px-2',
	base: 'py-2 px-4',
	lg: 'py-3 px-6',
};

const headerSizes: { [key: string]: string } = {
	sm: 'max-h-16 md:max-h-24',
	base: 'max-h-24',
};

export { iconSizes, buttonSizes, headerSizes };
