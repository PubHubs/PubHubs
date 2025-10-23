// Plugin imports
import forms from '@tailwindcss/forms';
import fluid, { extract } from 'fluid-tailwind';

module.exports = {
	darkMode: 'class',
	theme: {
		screens: {
			xs: '48rem',
			sm: '64rem',
			md: '76.8rem',
			lg: '102.4rem',
			xl: '144rem',
			'2xl': '153.6rem',
			'3xl': '192rem',
		},
		spacing: {
			0: '0',
			1: '0.4rem', // 4px
			2: '0.8rem', // 8px
			3: '1.2rem', // 12px
			4: '1.6rem', // 16px
			5: '2rem', // 20px
			6: '2.4rem', // 24px
			7: '2.8rem', // 28px
			8: '3.2rem', // 32px
			9: '3.6rem', // 36px
			10: '4rem', // 40px
			12: '4.8rem', // 48px
			16: '6.4rem', // 64px
			20: '8rem', // 80px
			24: '9.6rem', // 96px
			28: '11.2rem', // 112px
			32: '12.8rem', // 128px
			36: '14.4rem', // 144px
			40: '16rem', // 160px
			44: '17.6rem', // 176px
			48: '19.2rem', // 192px
			52: '20.8rem', // 208px
			56: '22.4rem', // 224px
			60: '24rem', // 240px
			64: '25.6rem', // 256px
		},
		extend: {
			colors: {
				current: 'currentColor',
				transparent: 'transparent',

				current: 'currentColor',
				transparent: 'transparent',

				background: 'var(--background)',
				surface: 'var(--surface)',
				'surface-subtle': 'var(--surface-subtle)',
				'surface-low': 'var(--surface-low)',
				'surface-high': 'var(--surface-high)',
				'on-surface': 'var(--on-surface)',
				'on-surface-variant': 'var(--on-surface-variant)',
				'on-surface-dim': 'var(--on-surface-dim)',
				'on-surface-disabled': 'var(--on-surface-disabled)',

				'accent-primary': 'var(--accent-primary)',
				'on-accent-primary': 'var(--on-accent-primary)',
				'accent-secondary': 'var(--accent-secondary)',
				'on-accent-secondary': 'var(--on-accent-secondary)',
				'accent-error': 'var(--accent-error)',
				'on-accent-error': 'var(--on-accent-error)',
				'accent-lime': 'var(--accent-lime)',
				'on-accent-lime': 'var(--on-accent-lime)',
				'accent-pink': 'var(--accent-pink)',
				'on-accent-pink': 'var(--on-accent-pink)',
				'accent-yellow': 'var(--accent-yellow)',
				'on-accent-yellow': 'var(--on-accent-yellow)',
				'accent-red': 'var(--accent-red)',
				'on-accent-red': 'var(--on-accent-red)',
				'accent-teal': 'var(--accent-teal)',
				'on-accent-teal': 'var(--on-accent-teal)',
				'accent-blue': 'var(--accent-blue)',
				'on-accent-blue': 'var(--on-accent-blue)',
				'accent-orange': 'var(--accent-orange)',
				'on-accent-orange': 'var(--on-accent-orange)',
			},
			fontFamily: {
				headings: ['work_sans'],
				body: ['atkinson_hyperlegible'],
			},
			fontSize: {
				'h1-min': '2.2rem',
				'h1-max': '2.4rem',
				'h2-min': '2.0rem',
				'h2-max': '2.2rem',
				'h3-min': '1.8rem',
				'h3-max': '2.0rem',
				'base-min': '1.6rem',
				'base-max': '1.8rem',
				'label-min': '1.6rem',
				'label-max': '1.8rem',
				'label-small-min': '1.2rem',
				'label-small-max': '1.4rem',
				'label-tiny-min': '0.9rem',
				'label-tiny-max': '1.2rem',
			},
		},
	},
	content: {
		files: ['./public/**/*.html', './src/**/*.{js,ts,jsx,tsx,vue}', '../hub-client/public/**/*.html', '../hub-client/src/**/*.{js,ts,jsx,tsx,vue}'],
		extract,
	},
	plugins: [
		fluid,
		forms,
		function ({ addVariant }) {
			addVariant('hover!', '&:hover!important');
		},
	],
};
