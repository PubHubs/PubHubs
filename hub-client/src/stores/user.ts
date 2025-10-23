// Packages
import { assert } from 'chai';
import { MatrixClient, User as MatrixUser } from 'matrix-js-sdk';
import { defineStore } from 'pinia';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import filters from '@hub-client/logic/core/filters';
import { router } from '@hub-client/logic/core/router';
import { ConsentJSONParser } from '@hub-client/logic/json-utility';
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { OnboardingType } from '@hub-client/models/constants';
import { Administrator } from '@hub-client/models/hubmanagement/models/admin';

// Stores
import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

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
	client: MatrixClient | undefined; // Store can also communicate with synapse for writes.
	userId: string | null;
	_avatarMxcUrl: string | undefined;
	_displayName: string | undefined | null;
	usersProfile: Map<string, { avatar_url?: string; displayname?: string }>;
	administrator: Administrator | null;
	isAdministrator: boolean;
	needsOnboarding: boolean;
	needsConsent: boolean;
};

const logger = LOGGER;

const useUser = defineStore('user', {
	state: (): State => ({
		client: undefined,
		userId: null,
		_avatarMxcUrl: undefined,
		_displayName: undefined,
		administrator: null,
		usersProfile: new Map<string, { avatar_url?: string; displayname?: string }>(),
		isAdministrator: false,
		needsOnboarding: false,
		needsConsent: false,
	}),

	getters: {
		user({ userId }) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			try {
				const clientUser = this.client.getUser(userId!);
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

		avatarUrl({ _avatarMxcUrl: _avatarMxcUrl }) {
			return _avatarMxcUrl;
		},

		displayName({ _displayName: _displayName }) {
			return _displayName;
		},

		pseudonym({ userId }): string {
			if (!userId) {
				logger.warn(SMI.USER, 'Missing userId when getting pseudonym, showing pseudonym as "xxx-xxx"');
				return 'xxx-xxx';
			}

			return filters.extractPseudonym(userId);
		},
		userConsent({ needsConsent }): boolean {
			return needsConsent;
		},

		userDisplayName: (state) => {
			return (userId: string): string | undefined => {
				return state.usersProfile.get(userId)?.displayname;
			};
		},
		userAvatar: (state) => {
			return (userId: string): string | undefined => {
				return state.usersProfile.get(userId)?.avatar_url;
			};
		},
	},
	actions: {
		// #region Setter method
		setClient(client: MatrixClient) {
			this.client = client;
		},

		// Storing my  UserId
		setUserId(userId: string) {
			this.userId = userId;
		},

		async setDisplayName(name: string) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			await this.client.setDisplayName(name);
			this._displayName = name;
		},

		async setAvatarMxcUrl(avatarUrl: string) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			await this.client.setAvatarUrl(avatarUrl);
			this._avatarMxcUrl = avatarUrl;
		},

		// Profile setter method for me.
		// This method is used during login of me.
		setProfile(profile: any) {
			if (profile.avatar_url !== undefined) this.setAvatarMxcUrl(profile.avatar_url);
			if (profile.displayname !== undefined) this.setDisplayName(profile.displayname);
		},

		// Profile setter method for all users.
		// This method is used when syncing profiles of users.
		setAllProfiles(userId: string, profileData: Object) {
			this.usersProfile.set(userId, profileData);
		},

		async setUserConsentVersion(version: number): Promise<void> {
			const data = {
				version: version,
			};
			try {
				await api_synapse.apiPOST(`${api_synapse.apiURLS.data}?data=consent`, data);
				this.needsConsent = false;
				this.needsOnboarding = false;
			} catch (error) {
				console.log(error);
			}
		},
		// #endregion

		// #region Fetchermethod //
		async fetchIsAdministrator(client: MatrixClient) {
			try {
				// API call returns true when succesful and isAdministrator, but throws an error when false
				// still we need to check the returnvalue for when it might be succesfully returned as false
				const isAdmin = await client.isSynapseAdministrator();
				if (isAdmin) {
					this.administrator = new Administrator();
					this.isAdministrator = true;
				} else {
					this.isAdministrator = false;
				}
			} catch (error) {
				this.isAdministrator = false;
			}
		},

		async fetchIfUserNeedsConsent(): Promise<boolean> {
			try {
				const settings = useSettings();
				if (!settings.isFeatureEnabled(FeatureFlag.consent)) return false;
				const response = (await api_synapse.apiGET(`${api_synapse.apiURLS.data}?data=consent`)) as ConsentJSONParser;
				if (response) {
					this.needsConsent = response.needs_consent;
					this.needsOnboarding = response.needs_onboarding;
				}
			} catch (error) {
				console.error('Could not check if user needs consent, ', error);
				router.push({ name: 'error-page' });
				this.needsConsent = true;
			}
			if (this.needsConsent || this.needsOnboarding) {
				const onboardingType = this.needsOnboarding ? OnboardingType.full : OnboardingType.consent;
				router.push({ name: 'onboarding', query: { type: onboardingType, originalRoute: router.currentRoute.value.path } });
			}
			return this.needsConsent;
		},

		// #endregion
	},
});

type CurrentUser = ReturnType<typeof useUser>;

export { CurrentUser, defaultUser, User, useUser };
