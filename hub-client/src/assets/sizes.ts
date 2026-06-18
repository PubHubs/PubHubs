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
	xs: 'py-0 px-100 h-300',
	sm: 'py-050 px-100',
	base: 'py-100 px-200',
	lg: 'py-150 px-300',
};

const headerSizes: { [key: string]: string } = {
	sm: 'max-h-800 md:max-h-1200',
	base: 'max-h-1200',
};

export { iconSizes, buttonSizes, headerSizes };
