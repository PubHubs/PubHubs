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
import { User as MatrixUser } from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

/**
 *  Extending the MatrixUser with some extra PubHubs specific methods :
 */
class User extends MatrixUser {
	get pseudonym(): string {
		const full = this.userId;
		return full.split(':')[0].replace('@', '');
	}
}

const defaultUser = {} as User;

type State = {
	user: User;
	avatarUrl: string;
	isAdministrator: boolean;
};

const useUser = defineStore('user', {
	state: (): State => ({
		user: defaultUser,
		avatarUrl: '',
		isAdministrator: false,
	}),

	getters: {
		isLoggedIn({ user }) {
			return typeof user.userId === 'string';
		},

		isAdmin({ isAdministrator }) {
			return isAdministrator;
		},
	},

	actions: {
		setUser(user: User) {
			this.user = user;
		},

		async fetchIsAdministrator(client: MatrixClient) {
			try {
				await client.isSynapseAdministrator();
				this.isAdministrator = true;
			} catch (error) {
				this.isAdministrator = false;
			}
		},
	},
});

export { User, defaultUser, useUser };
