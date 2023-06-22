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
            'light'     : '#FFFF66',
            'DEFAULT'   : '#FFFF00',
            'dark'      : '#FFDD00',
        },
        'green': {
            'lighter'   : '#FFCC33',
            'light'     : '#FFCC33',
            'DEFAULT'   : '#FF9900',
            'dark'      : '#CC9900',
        },
        'red': {
            'light'     : '#FF9999',
            'DEFAULT'   : '#FF0000',
            'dark'      : '#CC0000',
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
