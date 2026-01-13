// Packages
import { usePubhubsStore } from './pubhubs';
import { assert } from 'chai';
import { EventType, MatrixClient, User as MatrixUser } from 'matrix-js-sdk';
import { MSC3575RoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { defineStore } from 'pinia';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import filters from '@hub-client/logic/core/filters';
import { router } from '@hub-client/logic/core/router';
import { ConsentJSONParser } from '@hub-client/logic/json-utility';
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { MatrixType, OnboardingType } from '@hub-client/models/constants';
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

// profile info all users but current
type UserProfile = {
	displayName?: string;
	avatarUrl?: string;
	contentAvatarUrl?: string; // Authorized media changes the url. This is the original one so we can compare to the incoming one to see if we need to reload
};

const defaultUser = {} as User;

type State = {
	client: MatrixClient | undefined; // Store can also communicate with synapse for writes.
	userId: string | null;
	_avatarUrl: string | undefined; // In case of authorized media: this is the url of the cached blob
	_displayName: string | undefined | null;
	usersProfile: Map<string, UserProfile>; // Key-value pairs of users. Key=UserId.
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
		_avatarUrl: undefined,
		_displayName: undefined,
		administrator: null,
		usersProfile: new Map<string, UserProfile>(),
		isAdministrator: false,
		needsOnboarding: false,
		needsConsent: false,
	}),

	getters: {
		user({ userId }): MatrixUser | User {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			try {
				const clientUser = this.client.getUser(userId!);
				return clientUser ?? defaultUser;
			} catch {
				return defaultUser;
			}
		},

		isLoggedIn({ userId }): boolean {
			return typeof userId === 'string';
		},

		isAdmin({ isAdministrator }): boolean {
			return isAdministrator;
		},

		avatarUrl({ _avatarUrl }): string | undefined {
			return _avatarUrl;
		},

		displayName({ _displayName }): string | null | undefined {
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
				return state.usersProfile.get(userId)?.displayName;
			};
		},
		userAvatar: (state) => {
			return (userId: string): string | undefined => {
				return state.usersProfile.get(userId)?.avatarUrl;
			};
		},
	},
	actions: {
		// #region Setter method
		setClient(client: MatrixClient) {
			this.client = client;
		},

		async loadFromSlidingSync(roomData: MSC3575RoomData): Promise<boolean> {
			// profile data of members is in the join content of roommember events, need only update when there is new content
			const membersOnlyProfileUpdate = roomData.required_state?.filter((x) => x.type === EventType.RoomMember && x.content?.membership === MatrixType.Join && JSON.stringify(x.content) !== JSON.stringify(x.prev_content));
			if (!membersOnlyProfileUpdate || membersOnlyProfileUpdate.length === 0) return false;

			const { getAuthorizedMediaUrl } = useMatrixFiles();

			membersOnlyProfileUpdate.forEach(async (member) => {
				const memberToUpdate = this.usersProfile.get(member.sender);

				// data is going to be set async. So we already add a userprofile from the current data that we know of
				if (!memberToUpdate) {
					this.setUserProfile(member.sender, { displayName: member.content.displayname, contentAvatarUrl: member.content.avatar_url });
				}

				// only update the member if not available yet in userProfile, or if displayname/avatarurl has changed
				if (!memberToUpdate || memberToUpdate?.displayName !== member.content.displayname || memberToUpdate?.contentAvatarUrl !== member.content.avatar_url) {
					const avatarUrl = member.content.avatar_url ? await getAuthorizedMediaUrl(member.content.avatar_url) : '';
					const profile: UserProfile = {
						displayName: member.content.displayname ?? undefined,
						avatarUrl: avatarUrl,
						contentAvatarUrl: member.content.avatar_url,
					};
					this.setUserProfile(member.sender, profile);
				}
			});

			return true;
		},

		// Storing my  UserId
		setUserId(userId: string) {
			this.userId = userId;
		},

		async setDisplayName(name: string) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			this._displayName = name;
			this.client.setDisplayName(name);
		},

		async setAvatarUrl(avatarUrl: string) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');

			const { getAuthorizedMediaUrl } = useMatrixFiles();
			this._avatarUrl = await getAuthorizedMediaUrl(avatarUrl);
			this.client.setAvatarUrl(avatarUrl);
		},

		// Profile setter method for me.
		// This method is used during login of me.
		setProfile(profile: any) {
			if (profile.avatar_url !== undefined) this.setAvatarUrl(profile.avatar_url);
			if (profile.displayname !== undefined) this.setDisplayName(profile.displayname);
		},

		// Profile setter method for all users.
		// This method is used when syncing profiles of users.
		setUserProfile(userId: string, profileData: UserProfile) {
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
			} catch {
				this.isAdministrator = false;
			}
		},

		async fetchIfUserNeedsConsent(): Promise<boolean> {
			try {
				const settings = useSettings();
				if (!settings.isFeatureEnabled(FeatureFlag.consent)) return false;
				const response = await api_synapse.apiGET<ConsentJSONParser>(`${api_synapse.apiURLS.data}?data=consent`);
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

		async goToUserRoom(userId: string) {
			const pubhubs = usePubhubsStore();
			const otherUser = this.client!.getUser(userId);
			if (otherUser && this.userId !== otherUser.userId) {
				const userRoom = await pubhubs.createPrivateRoomWith(otherUser as User);
				if (userRoom) {
					await pubhubs.routeToRoomPage(userRoom);
				}
			}
		},

		// #endregion
	},
});

type CurrentUser = ReturnType<typeof useUser>;

export { CurrentUser, defaultUser, User, useUser };
