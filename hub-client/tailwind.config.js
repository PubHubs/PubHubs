/** @type {import('tailwindcss').Config} */

const plugin = require('tailwindcss/plugin');

const pubhubsTheme = require('./src/assets/pubhubs-theme.js');
const safeList = [
	'-mt-1',
	'absolute',
	'bg-avatar-green',
	'bg-avatar-purple',
	'bg-avatar-yellow',
	'bg-avatar-red',
	'bg-avatar-lime',
	'bg-avatar-blue',
	'bg-avatar-orange',
	'bg-blue-dark',
	'bg-blue',
	'bg-gray-lighter',
	'bg-gray-light',
	'bg-gray-middle',
	'bg-gray',
	'bg-red',
	'bg-white',
	'block',
	'border',
	'border-0',
	'border-white',
	'cursor-pointer',
	'flex-row-reverse',
	'flex',
	'float-right',
	'font-bold',
	'font-semibold',
	'grid',
	'grid-cols-8',
	'grid-cols-9',
	'grid-cols-10',
	'grid-cols-11',
	'grid-cols-12',
	'h-12',
	'h-16',
	'h-20',
	'h-24',
	'h-3',
	'h-4',
	'h-5',
	'h-6',
	'h-7',
	'h-8',
	'h-12',
	'h-screen',
	'inset-0',
	'left-0',
	'm-0',
	'm-auto',
	'mb-3',
	'mb-4',
	'ml-2',
	'mt-2',
	'mt-6',
	'opacity-75',
	'outline-none',
	'p-4',
	'px-2',
	'px-4',
	'px-6',
	'px-10',
	'py-1',
	'py-2',
	'py-3',
	'ring-2',
	'ring-opacity-75',
	'rounded-full',
	'rounded-l-none',
	'rounded-lg',
	'rounded-r-none',
	'shadow-black',
	'shadow-md',
	'shadow-xl',
	'text-avatar-green',
	'text-avatar-purple',
	'text-avatar-yellow',
	'text-avatar-red',
	'text-avatar-lime',
	'text-avatar-blue',
	'text-avatar-orange',
	'text-black',
	'text-blue-dark',
	'text-center',
	'text-gray',
	'text-green',
	'text-green-dark',
	'text-left',
	'text-red',
	'text-sm',
	'text-white',
	'top-0',
	'truncate',
	'w-12',
	'w-16',
	'w-2/6',
	'w-20',
	'w-24',
	'w-32',
	'w-3',
	'w-4',
	'w-5',
	'w-6',
	'w-7',
	'w-8',
	'w-full',
	'w-screen',
	'z-0',
	'z-10',
];

module.exports = {
	content: ['./public/**/*.html', './src/assets/*.js', './src/**/*.vue', './stories/**/*.vue'],
	safelist: safeList,
	theme: pubhubsTheme,
	darkMode: 'class',
	plugins: [
		require('@tailwindcss/forms'),
		plugin(function ({ addVariant }) {
			addVariant('theme-light', ['html .theme-light &', '.light &']);
			addVariant('theme-dark', ['html .theme-dark &', '.dark &']);
		}),
	],
};
