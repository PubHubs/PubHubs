/**
 * This store keeps the current loggedIn user and its states.
 *
 * with:
 * - definition (Name)
 * - defaults - defaults of this store (defaultName)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia';
import { User } from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

const defaultUser = {} as User;

type State = {
	user: User;
};

type getProfileInfoResponseType = {
	avatar_url?: string | undefined;
	displayname?: string | undefined;
};

const useUser = defineStore('user', {
	state: (): State => ({
		user: defaultUser,
	}),

	getters: {
		isLoggedIn({ user }) {
			return typeof user.userId == 'string';
		},
	},

	actions: {
		setUser(user: User) {
			this.user = user;
		},

		async fetchDisplayName(client: MatrixClient) {
			const response: getProfileInfoResponseType = await client.getProfileInfo(this.user.userId, 'displayname');
			if (typeof response.displayname == 'string') {
				this.user.setDisplayName(response.displayname);
			}
		},
	},
});

export { User, defaultUser, useUser };
