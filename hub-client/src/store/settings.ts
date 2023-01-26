/**
 * This store is used for global and user settings.
 *
 * with:
 * - definition (Name)
 * - defaults - defaults of this store (defaultName)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia'


enum Theme {
    System = 'system',
    Light = 'light',
    Dark = 'dark',
}


interface Settings {

    /**
     * The number of events to load on a page in a room.
     */

    pagination: number,

    /**
     * What message types will be visible as a normal message
     */

    visibleEventTypes: string[],

    /**
     * UI theme: system|dark|light
     */

    theme : Theme,

}


const defaultSettings: Settings = {
    theme : Theme.System,
    pagination: 50,
    visibleEventTypes: ['m.room.message'],
}


const useSettings = defineStore('settings', {

    state: () => {
        return defaultSettings as Settings;
    },

    getters: {

        getPagination: (state: Settings) => state.pagination,

        getVisibleEventTypes: (state: Settings) => state.visibleEventTypes,


        /**
         * Get theme set in preferences
         */
        getSetTheme: (state:Settings) : Theme => {
            return state.theme;
        },

        /**
         * Get theme set in preferences, and if 'system' give the 'light' or 'dark' theme depending on system.
         */
        getActiveTheme: (state:Settings) : Theme => {
            if ( state.theme != Theme.System ) {
                return state.theme;
            }
            if ( window.matchMedia('(prefers-color-scheme: dark)').matches)  {
                return Theme.Dark;
            }
            return Theme.Light;
        },

        /**
         * Get themes as options (for form selecting).
         * If nothing is given the label will be a capitalized version of the theme. If a function is given, the function will be used to generate the label. So you can give the localisation function $t.
         */
        getThemeOptions: () => (themes:any) => {
            const options = Object.values(Theme).map( e => {
                if ( typeof(themes) !== 'function') {
                    return {
                        label: e.charAt(0).toUpperCase()+e.slice(1),
                        value: e
                    };
                }
                else {
                    return {
                        label: themes('themes.'+e),
                        value: e
                    };
                }
            });
            return options;
        },

        isVisibleEventType : (state) => (type:string) => {
            return state.visibleEventTypes.includes(type);
        }

    },

    actions: {

        setPagination(newPagination: number) {
            this.pagination = newPagination;
        },

        setTheme(newTheme:Theme) {
            this.theme = newTheme;
        }

    },

})

export { Theme, Settings, defaultSettings, useSettings }
