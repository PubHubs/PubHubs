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
	avatarUrl: string;
	isAdministrator: boolean;
	client: MatrixClient;
	userId: string | null;
};

const useUser = defineStore('user', {
	state: (): State => ({
		avatarUrl: '',
		isAdministrator: false,
		client: {} as MatrixClient,
		userId: null,
	}),

	getters: {
		user({ userId, client }) {
			const clientUser = client.getUser(userId!);
			return clientUser ?? defaultUser;
		},

		isLoggedIn({ userId }) {
			return typeof userId === 'string';
		},

		isAdmin({ isAdministrator }) {
			return isAdministrator;
		},
	},

	actions: {
		setUserId(userId: string) {
			this.userId = userId;
		},

		setClient(client: MatrixClient) {
			this.client = client;
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
