import { defineStore } from 'pinia'

const defaultUser = {};

const useUser = defineStore('user', {

    state: () => {
        return {
            user : defaultUser,
        }
    },

    getters: {

        isLoggedIn(state:any) {
            return typeof(state.user.userId) == 'string';
        },

    },

    actions: {

        setUser(user:Object) {
            this.user = user;
        },

    },

})

export { defaultUser, useUser }
