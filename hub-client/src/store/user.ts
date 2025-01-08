/**
 * This store keeps the current loggedIn user and its states.
 *
 * with:
 * - definition (Name)
 * - defaults - defaults of this store (defaultName)
 * - the store itself (useName)
 *
 */

import { api_synapse } from '@/core/api';
import filters from '@/core/filters';
import { usePubHubs } from '@/core/pubhubsStore';
import { SMI } from '@/dev/StatusMessage';
import { LOGGER } from '@/foundation/Logger';
import { MatrixClient, User as MatrixUser } from 'matrix-js-sdk';
import { defineStore } from 'pinia';

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
	_avatarMxcUrl: string | undefined;
	_avatarUrl: string | undefined | null;
	_displayName: string | undefined | null;
	isAdministrator: boolean;
	needsOnboarding: boolean;
	client: MatrixClient;
	userId: string | null;
};

const logger = LOGGER;

const useUser = defineStore('user', {
	state: (): State => ({
		_avatarMxcUrl: undefined,
		_avatarUrl: undefined,
		_displayName: undefined,
		isAdministrator: false,
		needsOnboarding: false,
		client: {} as MatrixClient,
		userId: null,
	}),

	getters: {
		user({ userId, client }) {
			try {
				const clientUser = client.getUser(userId!);
				return clientUser ?? defaultUser;
			} catch (error) {
				return defaultUser;
			}
		},

		isLoggedIn({ userId }) {
			return typeof userId === 'string';
		},

		isAdmin({ isAdministrator }) {
			return isAdministrator;
		},

		avatarUrl({ _avatarUrl }) {
			return _avatarUrl;
		},

		displayName({ _displayName }) {
			return _displayName;
		},

		pseudonym({ userId }): string {
			if (!userId) {
				logger.warn(SMI.USER, 'Missing userId when getting pseudonym, showing pseudonym as "xxx-xxx"');
				return 'xxx-xxx';
			}

			return filters.extractPseudonym(userId);
		},
	},

	actions: {
		setUserId(userId: string) {
			this.userId = userId;
		},

		setProfile(profile: any) {
			if (profile.avatar_url !== undefined) this.setAvatarMxcUrl(profile.avatar_url);
			if (profile.displayname !== undefined) this.setDisplayName(profile.displayname);
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

		async fetchUserFirstTimeLoggedIn(): Promise<boolean> {
			const resp = await api_synapse.apiPOST<any>(api_synapse.apiURLS.joinHub, { user: this.userId! });
			this.needsOnboarding = resp.first_time_joined;
			return this.needsOnboarding;
		},

		setDisplayName(name: string | undefined | null) {
			this._displayName = name;
		},

		/**
		 *
		 * @param sync if set to true, the avatar will be changed in the backend as well
		 */
		setAvatarMxcUrl(avatarUrl: string, sync = false) {
			if (sync) {
				this.client.setAvatarUrl(avatarUrl);
			}

			this._avatarMxcUrl = avatarUrl;

			this.updateAvatarUrl();
		},

		async updateAvatarUrl(): Promise<void> {
			if (!this._avatarMxcUrl) {
				this._avatarUrl = this._avatarMxcUrl;
			} else {
				const pubhubs = usePubHubs();

				this._avatarUrl = await pubhubs.getAuthorizedMediaUrl(this._avatarMxcUrl);
			}
		},
	},
});

type CurrentUser = ReturnType<typeof useUser>;

export { CurrentUser, defaultUser, User, useUser };
