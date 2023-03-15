/**
 * This store has some specific settings only needed for the hub-client
 */

import { defineStore } from 'pinia'

const useHubSettings = defineStore('hub-settings', {

    state: () => {
        return {
            isSolo : window.self === window.top,
            visibleEventTypes: ['m.room.message'],
        };
    },

    getters: {

        getVisibleEventTypes: (state) => state.visibleEventTypes,

        isVisibleEventType : (state) => (type:string) => {
            return state.visibleEventTypes.includes(type);
        },

    },

    actions: {

    },

})

export { useHubSettings }
