/**
 * This store keeps the current loggedIn user and its states.
 *
 * with:
 * - definition (Name)
 * - defaults - defaults of this store (defaultName)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia'
import { User } from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

const defaultUser = {} as User;

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

        setUser(user: User) {
            this.user = user;
        },

        fetchDisplayName(client:MatrixClient) {
            client.getProfileInfo(this.user.userId, 'displayname').then((response: any) => {
                if (typeof (response.displayname) == 'string') {
                    this.user.setDisplayName(response.displayname);
                }
            });
        },

    },

})

export { User, defaultUser, useUser }
