/** @type {import('tailwindcss').Config} */

// color vars are set in `src/assets/tailwind.css`, and could be overwritten by `public/branding.css`

const pubhubs = {
	colors: {
		// Global pubhubs color palette
		ph: {
			background: {
				DEFAULT: 'var(--ph-background)',
				2: 'var(--ph-background-2)',
				3: 'var(--ph-background-3)',
				4: 'var(--ph-background-4)',
				5: 'var(--ph-background-5)',
			},
			text: 'var(--ph-text)',
			accent: {
				DEFAULT: 'var(--ph-accent)',
				2: 'var(--ph-accent-2)',
				icon: {
					DEFAULT: 'var(--ph-accent-icon)',
					2: 'var(--ph-accent-icon-2)',
					3: 'var(--ph-accent-icon-3)',
				},
			},
		},

		notification: 'var(--notification)',

		// Hub color palette default. Can be customised with hub branding.
		hub: {
			background: {
				DEFAULT: 'var(--hub-background)',
				2: 'var(--hub-background-2)',
				3: 'var(--hub-background-3)',
				4: 'var(--hub-background-4)',
				5: 'var(--hub-background-5)',
			},
			text: 'var(--hub-text)',
			accent: {
				DEFAULT: 'var(--hub-accent)',
				2: 'var(--hub-accent-2)',
				icon: {
					DEFAULT: 'var(--hub-accent-icon)',
					2: 'var(--hub-accent-icon-2)',
					3: 'var(--hub-accent-icon-3)',
				},
			},
		},

		transparent: 'transparent',
		current: 'currentColor',
		white: {
			DEFAULT: 'var(--white)',
			middle: 'var(--white-middle)',
		},
		black: 'var(--black)',
		lightgray: {
			light: 'var(--lightgray-light)',
			DEFAULT: 'var(--lightgray)',
			dark: 'var(--lightgray-dark)',
		},
		gray: {
			lighter: 'var(--gray-lighter)',
			light: 'var(--gray-light)',
			DEFAULT: 'var(--gray)',
			middle: 'var(--gray-middle)',
			dark: 'var(--gray-dark)',
			darker: 'var(--gray-darker)',
		},
		blue: {
			lighter: 'var(--blue-lighter)',
			light: 'var(--blue-light)',
			DEFAULT: 'var(--blue)',
			dark: 'var(--blue-dark)',
		},
		green: {
			lighter: 'var(--green-lighter)',
			light: 'var(--green-light)',
			DEFAULT: 'var(--green)',
			dark: 'var(--green-dark)',
			darker: 'var(--green-darker)',
		},
		red: {
			light: 'var(--red-light)',
			DEFAULT: 'var(--red)',
			dark: 'var(--red-dark)',
		},
		avatar: {
			// Put keys also in src/composables/useUserColor.ts
			green: '#52BC70',
			purple: '#BF5CD8',
			yellow: '#E7D63D',
			red: '#E45959',
			lime: '#27E0BF',
			blue: '#26CCF0',
			orange: '#FCBA6D',
		},
	},
	fontFamily: {
		sans: ['work_sansregular', 'work_sanssemibold', 'atkinson_hyperlegibleregular'],
	},
	extend: {
		screens: {
			xs: '360px',
			sm: '460px',
			'2md': '896px',
		},
		rotate: {
			135: '135deg',
		},
	},
};

module.exports = pubhubs;
