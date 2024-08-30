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
	// To overcome synapse slow update to avatar url
	userAvatarUrl: string;
	isAdministrator: boolean;
};

type getProfileInfoResponseType = {
	avatar_url?: string | undefined;
	displayname?: string | undefined;
};

const useUser = defineStore('user', {
	state: (): State => ({
		user: defaultUser,
		userAvatarUrl: '',
		isAdministrator: false,
	}),

	getters: {
		isLoggedIn({ user }) {
			return typeof user.userId === 'string';
		},

		avatarUrlOfUser({ userAvatarUrl }) {
			return userAvatarUrl;
		},

		isAdmin({ isAdministrator }) {
			return isAdministrator;
		},
	},

	actions: {
		setUser(user: User) {
			this.user = user;
		},

		async fetchDisplayName(client: MatrixClient) {
			if (client.getProfileInfo) {
				const response: getProfileInfoResponseType = await client.getProfileInfo(this.user.userId, 'displayname');
				if (typeof response.displayname === 'string') {
					this.user.setDisplayName(response.displayname);
					return response.displayname;
				}
			}
			return '';
		},

		async fetchAvatarUrl(client: MatrixClient) {
			if (client.getProfileInfo) {
				const response: getProfileInfoResponseType = await client.getProfileInfo(this.user.userId, 'avatar_url');
				if (typeof response.avatar_url === 'string') {
					this.user.setAvatarUrl(response.avatar_url);
					return response.avatar_url;
				}
			}
			return '';
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
