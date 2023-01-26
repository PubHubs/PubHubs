/** @type {import('tailwindcss').Config} */

const pubhubsTheme = require('./src/assets/pubhubs-theme.js');

module.exports = {
    content: ['./public/**/*.html', './src/**/*.{vue,js,ts,jsx,tsx}','./stories/**/*.vue'],
    theme: pubhubsTheme,
    darkMode: 'class',
    plugins: [
        require('@tailwindcss/forms'),
    ],
}
