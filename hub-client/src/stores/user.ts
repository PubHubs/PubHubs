// Packages
import { EventType, type MatrixClient, User as MatrixUser } from 'matrix-js-sdk';
import { type MSC3575RoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { defineStore } from 'pinia';

// Composables
import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import filters from '@hub-client/logic/core/filters';
import { hubStorage } from '@hub-client/logic/core/hubStorage';
import { isNetworkError } from '@hub-client/logic/core/networkError';
import { router } from '@hub-client/logic/core/router';
import { type ConsentJSONParser } from '@hub-client/logic/json-utility';
import { createLogger } from '@hub-client/logic/logging/Logger';
import { assert } from '@hub-client/logic/utils/assert';

// Models
import { MatrixType, OnboardingType } from '@hub-client/models/constants';
import { Administrator } from '@hub-client/models/hubmanagement/models/admin';
import { UserRole } from '@hub-client/models/users/TUser';

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
	usersProfile: Map<string, UserProfile>; // Key-value pairs of users. Key=UserId.
	administrator: Administrator | null;
	isAdministrator: boolean;
	adminStatusLoaded: boolean;
	needsOnboarding: boolean;
	needsConsent: boolean;
};

const logger = createLogger('User');

// The last consent answer from the hub, kept in HubStorage for when the hub can't be reached.
const CONSENT_STORAGE_KEY = 'consent';
type ConsentState = { needsConsent: boolean; needsOnboarding: boolean };

// The user's own profile as last known, kept in HubStorage for when the hub can't be reached (the hub
// sidebar shows it). The avatar is kept as the image itself: the blob: URL it is shown from is gone
// after a restart.
const OWN_PROFILE_STORAGE_KEY = 'ownProfile';
type OwnProfile = { displayName?: string; contentAvatarUrl?: string; avatarDataUrl?: string };

async function toDataUrl(objectUrl: string): Promise<string | undefined> {
	try {
		const blob = await (await fetch(objectUrl)).blob();
		const bytes = new Uint8Array(await blob.arrayBuffer());
		let binary = '';
		// In chunks: spreading a whole image into one call can exceed the argument limit.
		for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		return `data:${blob.type};base64,${btoa(binary)}`;
	} catch (error) {
		logger.warn('Could not keep the avatar image', { error });
		return undefined;
	}
}

const useUser = defineStore('user', {
	state: (): State => ({
		client: undefined,
		userId: null,
		administrator: null,
		usersProfile: new Map<string, UserProfile>(),
		isAdministrator: false,
		adminStatusLoaded: false,
		needsOnboarding: false,
		needsConsent: false,
	}),

	getters: {
		user({ userId }): MatrixUser | User {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');
			try {
				if (!userId) return defaultUser;
				const clientUser = this.client.getUser(userId);
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

		avatarUrl(state): string | undefined {
			return state.userId ? state.usersProfile.get(state.userId)?.avatarUrl : undefined;
		},

		displayName(state): string | null | undefined {
			return state.userId ? state.usersProfile.get(state.userId)?.displayName : undefined;
		},

		pseudonym({ userId }): string {
			if (!userId) {
				logger.warn('Missing userId when getting pseudonym, showing pseudonym as "xxx-xxx"');
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
			const membersOnlyProfileUpdate = roomData.required_state?.filter(
				(x) =>
					x.type === EventType.RoomMember &&
					x.content?.membership === MatrixType.Join &&
					JSON.stringify(x.content) !== JSON.stringify(x.prev_content),
			);
			if (!membersOnlyProfileUpdate || membersOnlyProfileUpdate.length === 0) return false;

			const { getAuthorizedMediaUrl } = useMatrixFiles();

			membersOnlyProfileUpdate.forEach(async (member) => {
				const memberToUpdate = this.usersProfile.get(member.sender);

				// data is going to be set async. So we already add a userprofile from the current data that we know of
				if (!memberToUpdate) {
					this.setUserProfile(member.sender, { displayName: member.content.displayname, contentAvatarUrl: member.content.avatar_url });
				}

				// only update the member if not available yet in userProfile, or if displayname/avatarurl has changed
				if (
					!memberToUpdate ||
					memberToUpdate?.displayName !== member.content.displayname ||
					memberToUpdate?.contentAvatarUrl !== member.content.avatar_url
				) {
					const profile: UserProfile = {};

					if (memberToUpdate?.displayName !== member.content.displayname) {
						profile.displayName = member.content.displayname ?? undefined;
					}

					if (memberToUpdate?.contentAvatarUrl !== member.content.avatar_url) {
						// Revoke old avatar blob URL before replacing
						if (memberToUpdate?.avatarUrl?.startsWith('blob:')) {
							URL.revokeObjectURL(memberToUpdate.avatarUrl);
						}
						const avatarUrl = member.content.avatar_url ? await getAuthorizedMediaUrl(member.content.avatar_url) : '';
						profile.avatarUrl = avatarUrl;
						profile.contentAvatarUrl = member.content.avatar_url;
					}

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
			try {
				await this.client.setDisplayName(name);
			} catch (error) {
				logger.error('Failed to set display name on server', error);
				return;
			}
			if (this.userId) {
				const existing = this.usersProfile.get(this.userId) ?? {};
				this.setUserProfile(this.userId, { ...existing, displayName: name });
				void this.storeOwnProfile();
			}
		},

		async setAvatarUrl(avatarUrl: string) {
			assert.isDefined(this.client, 'MatrixClient in userstore not initialized');

			const { getAuthorizedMediaUrl } = useMatrixFiles();
			const authorizedUrl = await getAuthorizedMediaUrl(avatarUrl);

			try {
				await this.client.setAvatarUrl(avatarUrl);
			} catch (error) {
				logger.error('Failed to set avatar on server', error);
				return;
			}

			// Revoke old avatar blob URL before replacing
			const oldAvatar = this.userId ? this.usersProfile.get(this.userId)?.avatarUrl : undefined;
			if (oldAvatar?.startsWith('blob:')) {
				URL.revokeObjectURL(oldAvatar);
			}

			if (this.userId) {
				const existing = this.usersProfile.get(this.userId) ?? {};
				this.setUserProfile(this.userId, { ...existing, contentAvatarUrl: avatarUrl, avatarUrl: authorizedUrl });
				void this.storeOwnProfile();
			}
		},

		// Profile setter method for me.
		// This method is used during login of me.
		async setProfile(profile: { avatar_url?: string; displayname?: string }) {
			if (!this.userId) return;

			const existing = this.usersProfile.get(this.userId) ?? {};
			const profileData: UserProfile = { ...existing };

			if (profile.displayname !== undefined) {
				profileData.displayName = profile.displayname;
			}

			if (profile.avatar_url !== undefined) {
				const { getAuthorizedMediaUrl } = useMatrixFiles();
				const authorizedUrl = await getAuthorizedMediaUrl(profile.avatar_url);
				const oldAvatar = this.usersProfile.get(this.userId)?.avatarUrl;
				if (oldAvatar?.startsWith('blob:')) {
					URL.revokeObjectURL(oldAvatar);
				}
				profileData.avatarUrl = authorizedUrl;
				profileData.contentAvatarUrl = profile.avatar_url;
			}

			this.setUserProfile(this.userId, profileData);
			void this.storeOwnProfile();
		},

		/** Keep the own profile in HubStorage, see {@link restoreOwnProfile}. */
		async storeOwnProfile() {
			if (!this.userId) return;
			const profile = this.usersProfile.get(this.userId);
			if (!profile) return;
			const avatarUrl = profile.avatarUrl;
			const avatarDataUrl = avatarUrl?.startsWith('blob:') ? await toDataUrl(avatarUrl) : avatarUrl?.startsWith('data:') ? avatarUrl : undefined;
			await hubStorage.set<OwnProfile>(OWN_PROFILE_STORAGE_KEY, {
				displayName: profile.displayName,
				contentAvatarUrl: profile.contentAvatarUrl,
				avatarDataUrl,
			});
		},

		/** Show the own profile as last known, for when the hub can't be reached. */
		async restoreOwnProfile() {
			const cached = await hubStorage.get<OwnProfile>(OWN_PROFILE_STORAGE_KEY);
			if (!cached || !this.userId) return;
			const existing = this.usersProfile.get(this.userId) ?? {};
			this.setUserProfile(this.userId, {
				...existing,
				displayName: cached.displayName,
				contentAvatarUrl: cached.contentAvatarUrl,
				avatarUrl: cached.avatarDataUrl,
			});
		},

		// Profile setter method for all users.
		// This method is used when syncing profiles of users.
		setUserProfile(userId: string, profileData: UserProfile) {
			this.usersProfile.set(userId, profileData);
		},

		/**
		 * @throws when the hub could not store the consent; the caller has to tell the user, who would
		 *   otherwise be sent back to the house rules without knowing why.
		 */
		async setUserConsentVersion(version: number): Promise<void> {
			const data = {
				version: version,
			};
			await api_synapse.apiPOST(`${api_synapse.apiURLS.data}?data=consent`, data);
			this.needsConsent = false;
			this.needsOnboarding = false;
			void hubStorage.set<ConsentState>(CONSENT_STORAGE_KEY, { needsConsent: false, needsOnboarding: false });
		},
		// #endregion

		// #region Fetchermethod //
		async fetchIsAdministrator(client: MatrixClient) {
			this.adminStatusLoaded = false;
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
			} finally {
				this.adminStatusLoaded = true;
				const currentRoute = router.currentRoute.value;
				const accessFor = currentRoute.meta?.accessFor as Array<UserRole> | undefined;
				const isAdminOnlyRoute = accessFor?.length === 1 && accessFor[0] === UserRole.Admin;
				if (isAdminOnlyRoute && !this.isAdministrator) {
					router.push({ name: 'home' });
				}
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
					void hubStorage.set<ConsentState>(CONSENT_STORAGE_KEY, { needsConsent: this.needsConsent, needsOnboarding: this.needsOnboarding });
				}
			} catch (error) {
				if (isNetworkError(error)) {
					// Go by the last answer from the hub. Without one, ask for consent: a request the hub's CORS
					// policy blocks looks just like an unreachable hub, while the rest of the hub may still work,
					// so letting the user in would skip the house rules. This runs again once the hub is back.
					const cached = await hubStorage.get<ConsentState>(CONSENT_STORAGE_KEY);
					logger.warn('The hub is unreachable; using the last known consent state', { cached });
					this.needsConsent = cached?.needsConsent ?? true;
					this.needsOnboarding = cached?.needsOnboarding ?? false;
				} else {
					logger.error('Could not check if user needs consent, ', error);
					router.push({ name: 'error-page' });
					this.needsConsent = true;
				}
			}
			// Already on the onboarding page (a re-check on reconnect): pushing it again would make it its own originalRoute.
			if ((this.needsConsent || this.needsOnboarding) && router.currentRoute.value.name !== 'onboarding') {
				const onboardingType = this.needsOnboarding ? OnboardingType.full : OnboardingType.consent;
				router.push({ name: 'onboarding', query: { type: onboardingType, originalRoute: router.currentRoute.value.path } });
			}
			return this.needsConsent;
		},

		async goToUserRoom(userId: string) {
			const dm = useDirectMessage();
			await dm.goToUserDM(userId);
		},

		// #endregion
	},
});

type CurrentUser = ReturnType<typeof useUser>;

export { CurrentUser, defaultUser, User, useUser };
