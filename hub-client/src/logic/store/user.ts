/**
 * This store keeps the current loggedIn user and its states.
 *
 * with:
 * - definition (Name)
 * - defaults - defaults of this store (defaultName)
 * - the store itself (useName)
 *
 */

import { FeatureFlag, useSettings } from './settings';
import { MatrixClient, User as MatrixUser } from 'matrix-js-sdk';

import { Administrator } from '@/model/hubmanagement/models/admin';
import { ConsentJSONParser } from './json-utility';
import { LOGGER } from '@/logic/foundation/Logger';
import { OnboardingType } from '@/model/constants';
import { SMI } from '@/logic/foundation/StatusMessage';
import { api_synapse } from '@/logic/core/api';
import { defineStore } from 'pinia';
import filters from '@/logic/core/filters';
import { router } from '@/logic/core/router';
import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';

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
	// avatarUrl: string;
	administrator: Administrator | null;
	_avatarMxcUrl: string | undefined;
	_avatarUrl: string | undefined | null;
	_displayName: string | undefined | null;
	isAdministrator: boolean;
	needsOnboarding: boolean;
	needsConsent: boolean;
	client: MatrixClient;
	userId: string | null;
};

const logger = LOGGER;

const useUser = defineStore('user', {
	state: (): State => ({
		administrator: null,
		_avatarMxcUrl: undefined,
		_avatarUrl: undefined,
		_displayName: undefined,
		isAdministrator: false,
		needsOnboarding: false,
		needsConsent: false,
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
		userConsent({ needsConsent }): boolean {
			return needsConsent;
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
				this.administrator = new Administrator();
				this.isAdministrator = true;
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
				const matrixfiles = useMatrixFiles();
				const settingsStore = useSettings();

				this._avatarUrl = await matrixfiles.useAuthorizedMediaUrl(this._avatarMxcUrl, settingsStore.isFeatureEnabled(FeatureFlag.authenticatedMedia));
			}
		},
	},
});

type CurrentUser = ReturnType<typeof useUser>;

export { CurrentUser, defaultUser, User, useUser };
