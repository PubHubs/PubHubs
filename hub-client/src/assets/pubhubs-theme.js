/** @type {import('tailwindcss').Config} */

module.exports = {
    colors: {
        transparent: 'transparent',
        current: 'currentColor',
        'white' : '#FFF',
        'black' : '#000',
        'gray': {
            'light'     : '#AAA',
            'DEFAULT'   : '#686868',
            'middle'    : '#464545',
            'dark'      : '#3D3C3C',
            'darker'    : '#2F2E2E',
        },
        'blue': {
            'light'     : '#67e8f9',
            'DEFAULT'   : '#408BE1',
            'dark'      : '#001242',
        },
        'green': {
            'light'     : '#7EE6A9',
            'DEFAULT'   : '#5EC269',
            'dark'      : '#3EA439',
        },
        'red': {
            'light'     : '#ff3333',
            'DEFAULT'   : '#ff0000',
            'dark'      : '#660000',
        },
        'avatar' : {                // Put keys also in src/composables/useUserColor.ts
            'green'     : '#61FE8D',
            'purple'    : '#BF5CD8',
            'yellow'    : '#E7D63D',
            'red'       : '#E45959',
            'lime'      : '#27E0BF',
            'blue'      : '#26CCF0',
            'orange'    : '#FCBA6D',
        },
    },
    fontFamily:{
        sans: [
            'work_sansregular',
            'work_sanssemibold',
            'atkinson_hyperlegibleregular',
          ],
    },
}
