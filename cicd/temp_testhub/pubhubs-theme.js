/** @type {import('tailwindcss').Config} */

module.exports = {
    colors: {
        transparent: 'transparent',
        current: 'currentColor',
        'white' : '#FFF',
        'black' : '#000',
        'gray': {
            'light'     : '#ffb000',
            'DEFAULT'   : '#3D3C3C',
            'middle'    : '#464545',
            'dark'      : '#3D3C3C',
            'darker'    : '#3D3C3C',
        },
        'blue': {
            'light'     : '#648fff',
            'DEFAULT'   : '#648fff',
            'dark'      : '#648fff',
        },
        'green': {
            'light'     : '#785ef0',
            'DEFAULT'   : '#785ef0',
            'dark'      : '#785ef0',
        },
        'red': {
            'light'     : '#fe6100',
            'DEFAULT'   : '#fe6100',
            'dark'      : '#fe6100',
        },
        'avatar' : {                // Put keys also in src/composables/useUserColor.ts
            'green'     : '#648fff',
            'purple'    : '#dc267f',
            'yellow'    : '#ffb000',
            'red'       : '#fe6100',
            'lime'      : '#785ef0',
            'blue'      : '#ffb000',
            'orange'    : '#fe6100',
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
