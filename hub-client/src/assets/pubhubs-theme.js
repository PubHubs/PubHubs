/** @type {import('tailwindcss').Config} */

// color vars are set in `src/assets/tailwind.css`, and could be overwritten by `public/branding.css`

const pubhubs = {
    colors: {
        transparent: 'transparent',
        current: 'currentColor',
        white: {
            DEFAULT: 'var(--white)',
            middle: 'var(--white-middle)',
        },
        black: 'var(--black)',
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
            green: '#61FE8D',
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
};


module.exports = pubhubs;
