/** @type {import('tailwindcss').Config} */

const hub = require('./hub-theme.js');

const pubhubs = {
    colors: {
        transparent: 'transparent',
        current: 'currentColor',
        white: {
            DEFAULT: '#FFF',
            middle: '#E7E3E3',
        },
        black: '#000',
        gray: {
            lighter: '#CCC',
            light: '#AAA',
            DEFAULT: '#646464',
            middle: '#464545',
            dark: '#3D3C3C',
            darker: '#2F2E2E',
        },
        blue: {
            lighter: '#67e8f9',
            light: '#00ADEE',
            DEFAULT: '#408BE1',
            dark: '#001242',
        },
        green: {
            lighter: '#00EE98',
            light: '#7EE6A9',
            DEFAULT: '#5EC269',
            dark: '#3EA439',
            darker: '#1C8217',
        },
        red: {
            light: '#ff3333',
            DEFAULT: '#ff0000',
            dark: '#660000',
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

function merge(current, updates) {
    for (key of Object.keys(updates)) {
        if (!current.hasOwnProperty(key) || typeof updates[key] !== 'object') current[key] = updates[key];
        else merge(current[key], updates[key]);
    }
    return current;
}

const theme = merge(pubhubs, hub);
module.exports = theme;
