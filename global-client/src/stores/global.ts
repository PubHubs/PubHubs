// Packages
import { defineStore } from 'pinia';

// Logic
import { api } from '@global-client/logic/core/api';
import { mergeGlobalSettings } from '@global-client/logic/utils/globalSettingsMerge';

import { isNetworkError } from '@hub-client/logic/core/networkError';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { Hub } from '@global-client/models/Hubs';
import { type HubInformation } from '@global-client/models/MSS/TPHC';

// Stores
import { useHubs } from '@global-client/stores/hubs';
import { useLocalStores } from '@global-client/stores/localStores';
import { useMSS } from '@global-client/stores/mss';

import { Theme, TimeFormat, useSettings } from '@hub-client/stores/settings';

// Types
type PinnedHub = {
	hubId: string;
	hubName: string;
	accessToken?: string;
	userId?: string;
};

type PinnedHubs = Array<PinnedHub>;

interface GlobalSettings {
	theme: Theme;
	timeformat: TimeFormat;
	language: string;
	hubs: PinnedHubs;
	lastHubId: string; // Contains the hubId of the last visited hub.
}

const defaultGlobalSettings = {
	theme: Theme.System,
	timeformat: TimeFormat.format24,
	language: 'nl', // Default language is set in `hub-client/src/i18n.ts`.
	hubs: [] as PinnedHubs,
	lastHubId: '',
};

const GLOBAL_SETTINGS_HANDLE = 'globalsettings';

const logger = createLogger('Global');

/**
 * The global settings as last loaded from (or stored at) PHC, with the hash PHC stores them under
 * (null: PHC has none yet). Saving only happens once this is known, and only on top of it, so a
 * failed load can never overwrite the server copy. See saveGlobalSettings.
 */
let loadedSettings: { data: GlobalSettings; hash: string | null } | null = null;

// saveGlobalSettings runs one save at a time; a change during a save triggers one more afterwards.
let saveRunning: Promise<void> | null = null;
let saveAgain = false;

function cloneSettings(data: GlobalSettings): GlobalSettings {
	return JSON.parse(JSON.stringify(data)) as GlobalSettings;
}

/**
 * An encrypted copy of the settings on this device (in the LocalStore, under a pseudo hub id), so they
 * are there while PHC is unreachable: `current` is what the user sees, `base` the copy last loaded from
 * or stored at PHC. When they differ, the difference still has to be stored at PHC.
 */
type CachedSettings = { current: GlobalSettings; base: { data: GlobalSettings; hash: string | null } };

const SETTINGS_CACHE_STORE = '__global__';
const SETTINGS_CACHE_KEY = 'globalSettings';

async function settingsCache() {
	const localStores = await useLocalStores().retrieve();
	return localStores ? await localStores.getOrCreate(SETTINGS_CACHE_STORE) : null;
}

async function readCachedSettings(): Promise<CachedSettings | null> {
	try {
		const raw = await (await settingsCache())?.get(SETTINGS_CACHE_KEY);
		return raw ? (JSON.parse(raw) as CachedSettings) : null;
	} catch (error) {
		logger.error('Could not read the cached global settings', error);
		return null;
	}
}

// Only on top of a known base: edits made on top of defaults (nothing loaded yet) must never be kept.
async function writeCachedSettings(current: GlobalSettings): Promise<void> {
	if (!loadedSettings) return;
	try {
		const cached: CachedSettings = { current, base: loadedSettings };
		await (await settingsCache())?.set(SETTINGS_CACHE_KEY, JSON.stringify(cached));
	} catch (error) {
		logger.error('Could not cache the global settings', error);
	}
}

/**
 * Whether this device holds a session with PHC. The logout procedure ends it, also while the login
 * check is still running. `loggedIn` is only set once the settings are in as well.
 */
function hasSession(): boolean {
	return localStorage.getItem('PHauthToken') !== null;
}

function sameSettings(a: GlobalSettings, b: GlobalSettings): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

// Field by field: the copy from PHC may list its keys in another order, or lack ones added since.
function sameAsStored(applied: GlobalSettings, stored: GlobalSettings): boolean {
	return (
		applied.theme === stored.theme &&
		applied.timeformat === stored.timeformat &&
		applied.language === stored.language &&
		(applied.lastHubId ?? '') === (stored.lastHubId ?? '') &&
		JSON.stringify(applied.hubs ?? []) === JSON.stringify(stored.hubs ?? [])
	);
}

const useGlobal = defineStore('global', {
	state: () => {
		return {
			loggedIn: false,
			modalVisible: false,
			// Mirrors the active hub's back state (MessageType.BackState): the hub closes a sidebar or
			// an open forum post itself, so a back swipe must not scroll the hub out of view instead.
			// Defaults to false, so a hub that never reports leaves the scroll behaviour as it was.
			hubCanGoBack: false,
			pinnedHubs: [] as PinnedHubs,
			hubsLoading: false,
			// How many hub loads are running. A load that finishes while another is still going must
			// leave `hubsLoading` set, or the spinner clears and the hub lists flash empty.
			hubLoadsInFlight: 0,

			// The login check currently in flight, so a second caller can await it instead of starting a
			// competing one. See checkLoginAndSettings.
			loginCheck: null as Promise<boolean> | null,

			// The pinned-hub load, kept for the lifetime of the session. See getPinnedHubsData.
			pinnedHubsLoad: null as Promise<void> | null,
		};
	},

	getters: {
		isModalVisible(state): boolean {
			return state.modalVisible;
		},

		getGlobalSettings(state): GlobalSettings {
			const settings = useSettings();
			const globalSettings: GlobalSettings = {
				theme: settings.theme,
				timeformat: settings.getTimeFormat,
				language: settings.getActiveLanguage,
				hubs: state.pinnedHubs,
				lastHubId: settings.getLastVisitedHub,
			};
			return globalSettings;
		},

		hasPinnedHubs(state): boolean {
			if (!state.pinnedHubs) return false;
			return state.pinnedHubs.length > 0;
		},
	},

	actions: {
		/**
		 *
		 * @returns a promise that resolves to true if the user is logged in and the settings are loaded, false otherwise
		 *
		 * Concurrent callers share one check. The router guard runs this until the user is logged in while
		 * App.vue needs its result on mount, and two runs in parallel would both overwrite `pinnedHubs`
		 * from separate fetches. The promise is dropped once it settles, so a later caller still re-checks.
		 */
		checkLoginAndSettings(): Promise<boolean> {
			this.loginCheck ??= this.loadLoginAndSettings().finally(() => {
				this.loginCheck = null;
			});
			return this.loginCheck;
		},

		async loadLoginAndSettings(): Promise<boolean> {
			const mss = useMSS();
			// If no authToken is stored in localstorage, this means the user is not logged in.
			if (!hasSession()) {
				this.loggedIn = false;
				return false;
			}
			// A session is enough to be logged in, also while PHC can't be reached, but loggedIn is only set
			// once the settings are in (see finishLogin). A check while already logged in leaves it set.
			try {
				const stored = await mss.requestUserObjectWithHash(GLOBAL_SETTINGS_HANDLE);
				// PHC refused the session while loading, and the logout procedure already ran.
				if (!hasSession()) return false;
				const remote = stored ? (JSON.parse(stored.data) as GlobalSettings) : cloneSettings(defaultGlobalSettings);
				loadedSettings = { data: cloneSettings(remote), hash: stored?.hash ?? null };

				// Changes made on this device while PHC was unreachable are kept, merged with what PHC has now;
				// finishLogin then stores the result.
				const cached = await readCachedSettings();
				const data = cached && !sameSettings(cached.current, cached.base.data) ? mergeGlobalSettings(cached.base.data, cached.current, remote) : remote;
				await this.setGlobalSettings(data);
				await writeCachedSettings(cloneSettings(data));
				return this.finishLogin();
			} catch (error) {
				if (isNetworkError(error)) {
					// Carry on with the copy on this device, and store any changes on top of what PHC had then.
					logger.warn('PHC is unreachable; using the global settings cached on this device', error);
					const cached = await readCachedSettings();
					loadedSettings = cached?.base ?? null;
					await this.setGlobalSettings(cached ? cloneSettings(cached.current) : cloneSettings(defaultGlobalSettings));
					return this.finishLogin();
				}
				// Keep the stored login: this also runs on every navigation, and a network hiccup or PHC
				// being restarted must not log the user out. An auth token that is really no longer valid
				// is caught by the refresh endpoint, which logs out properly.
				logger.error('Failure to set global settings', error);
				this.loggedIn = false;
				loadedSettings = null;
				return false;
			}
		},

		/**
		 * The settings are in: only now is the user logged in, so everything reading loggedIn can rely on
		 * the pinned hubs and their tokens being there.
		 */
		finishLogin(): boolean {
			// Logged out while the settings were loading.
			if (!hasSession()) return false;
			this.loggedIn = true;
			// Nothing is stored while loading (storeGlobalSettings waits for loggedIn), so a half-applied
			// state never reaches PHC. The settings may have changed on the way in (merged with changes
			// made offline, hub names brought up to date): if so, store them now.
			if (loadedSettings && !sameAsStored(this.getGlobalSettings, loadedSettings.data)) void this.saveGlobalSettings();
			return true;
		},

		async setGlobalSettings(incoming: GlobalSettings) {
			logger.info('setGlobalSettings', incoming);
			const data: GlobalSettings = { ...defaultGlobalSettings, ...incoming, hubs: [...(incoming.hubs ?? [])] };
			const settings = useSettings();
			settings.setTheme(data.theme);
			if (!data.timeformat || (data.timeformat as string) === '') {
				data.timeformat = TimeFormat.format24;
			}
			settings.setTimeFormat(data.timeformat);
			if (!data.language || data.language === '') {
				if (settings._i18n?.locale) {
					data.language = settings._i18n?.locale.value ?? navigator.language;
				} else {
					data.language = navigator.language;
				}
			}
			settings.setLanguage(data.language);
			settings.setLastVisitedHub(data.lastHubId);

			const mss = useMSS();
			// Check if the hubName has changed since the last update of the global settings object. Best
			// effort: the stored names are fine while PHC is unreachable.
			try {
				const hubs = await mss.getHubs();
				data.hubs.forEach((hub: PinnedHub) => {
					const hubName = hubs.find((hubRespItem) => hubRespItem.id === hub.hubId)?.name;
					if (hubName) {
						hub.hubName = hubName;
					}
				});
			} catch (error) {
				if (!isNetworkError(error)) throw error;
			}
			this.pinnedHubs = data.hubs;
		},

		login(language: string) {
			switch (language) {
				case 'en':
					window.location.assign(api.apiURLS.loginEn);
					break;
				case 'nl':
					window.location.assign(api.apiURLS.login);
					break;
				default:
					window.location.assign(api.apiURLS.login);
			}
		},

		async logout(message?: { key: string; values?: string[] }) {
			this.loggedIn = false;
			// The next user to log in has their own pinned hubs, so this session's load must not be
			// handed to them as already done.
			this.pinnedHubsLoad = null;
			loadedSettings = null;

			const mss = useMSS();
			mss.logout();

			// TODO: find a way router can be part of a store that TypeScript swallows.
			// @ts-expect-error -- router is injected as plugin, not in store type
			await this.router.replace({
				name: 'login',
				query: message ? { message: message.key, messageValues: message.values?.join(',') } : undefined,
			});
		},

		// Will be called after each relevant change in state (watched in App.vue)
		async saveGlobalSettings() {
			if (saveRunning) {
				saveAgain = true;
				return saveRunning;
			}
			saveRunning = (async () => {
				do {
					saveAgain = false;
					await this.storeGlobalSettings();
				} while (saveAgain);
			})().finally(() => {
				saveRunning = null;
			});
			return saveRunning;
		},

		/**
		 * Store the current settings on top of the copy last loaded from PHC. If another device changed
		 * the settings in the meantime, merge (see globalSettingsMerge.ts) and try again.
		 */
		async storeGlobalSettings() {
			if (!this.loggedIn || !loadedSettings) {
				return;
			}
			const mss = useMSS();
			let data = cloneSettings(this.getGlobalSettings);
			// First on this device, so the change survives if PHC can't be reached now.
			await writeCachedSettings(data);
			try {
				for (let attempt = 0; attempt < 3; attempt++) {
					const base = loadedSettings;
					const stored = await mss.storeUserObjectIfUnchanged<GlobalSettings>(GLOBAL_SETTINGS_HANDLE, data, base.hash);
					if (stored.result === 'stored') {
						loadedSettings = { data, hash: stored.hash };
						await writeCachedSettings(data);
						return;
					}
					if (stored.result === 'loggedOut') {
						return;
					}
					const remote = await mss.requestUserObjectWithHash(GLOBAL_SETTINGS_HANDLE);
					const remoteData = remote ? (JSON.parse(remote.data) as GlobalSettings) : cloneSettings(defaultGlobalSettings);
					data = mergeGlobalSettings(base.data, data, remoteData);
					loadedSettings = { data: remoteData, hash: remote?.hash ?? null };
					this.applyGlobalSettings(data);
				}
				throw new Error('The global settings kept changing while storing them.');
			} catch (error) {
				logger.error('Could not store the global settings', error);
				if (!isNetworkError(error)) {
					// @ts-expect-error -- router is injected as plugin, not in store type
					this.router.push({ name: 'error' });
				}
			}
		},

		/** Show merged settings without a round trip to PHC; setGlobalSettings also refreshes hub names. */
		applyGlobalSettings(data: GlobalSettings) {
			const settings = useSettings();
			settings.setTheme(data.theme);
			settings.setTimeFormat(data.timeformat);
			settings.setLanguage(data.language);
			this.pinnedHubs = cloneSettings(data).hubs;
		},

		addPinnedHub(hub: PinnedHub, order: number = -1) {
			if (!this.pinnedHubs) {
				this.pinnedHubs = [] as PinnedHubs;
			}
			// make sure the hub is flattend, we only need the hubId
			hub = { hubId: hub.hubId, hubName: hub.hubName };
			if (order < 0 || order > this.pinnedHubs.length) {
				this.pinnedHubs.push(hub);
			} else {
				this.pinnedHubs.splice(order, 0, hub);
			}
		},

		removePinnedHub(order: number) {
			this.pinnedHubs.splice(order, 1);
		},

		addAccessTokenAndUserID(hubId: string, token: string, userId: string) {
			const index = this.pinnedHubs.findIndex((hub) => hub.hubId === hubId);
			this.pinnedHubs[index].accessToken = token;
			this.pinnedHubs[index].userId = userId;
		},

		removeAccessToken(hubId: string) {
			const index = this.pinnedHubs.findIndex((hub) => hub.hubId === hubId);
			this.pinnedHubs[index].accessToken = undefined;
		},

		/**
		 * Load the data of every pinned hub, once per session. The app start (App.vue) and the
		 * navigation guard both need it and race each other on a page load, so the second caller
		 * awaits the first one's request instead of sending a competing one.
		 */
		async getPinnedHubsData() {
			if (!this.pinnedHubsLoad) {
				const pinnedHubIds = new Set(this.pinnedHubs.map((h) => h.hubId));
				this.pinnedHubsLoad = this.loadHubs((item) => pinnedHubIds.has(item.id)).then((answered) => {
					// Only the copy on this device could be shown: load again next time, so the hubs are
					// refreshed once PHC is back.
					if (!answered) this.pinnedHubsLoad = null;
				});
				// A failed load must not stay behind as the session's answer, or every later caller
				// would resolve straight away with no hubs loaded.
				this.pinnedHubsLoad.catch(() => (this.pinnedHubsLoad = null));
			}
			await this.pinnedHubsLoad;
		},

		async getAllHubs() {
			await this.loadHubs();
		},

		/**
		 * Load the data of one hub. Only pinned hubs are loaded at startup, so a link to any other hub
		 * (shared by someone, or the redirect after logging in) has to fetch that hub on its own.
		 */
		async getHubData(hubName: string) {
			await this.loadHubs((item) => item.name === hubName);
		},

		/**
		 * Run a hub fetch, reporting it through `hubsLoading` for as long as it lasts. The pinned-hub
		 * and discover loads can overlap, so the flag is tied to the number of loads still running
		 * rather than set and cleared by each of them in turn. It is only set when there is nothing to
		 * show yet: the list starts from the copy on this device (see hubsCache.ts).
		 */
		async loadHubs(include: (item: HubInformation) => boolean = () => true): Promise<boolean> {
			this.hubLoadsInFlight++;
			if (!useHubs().hasHubs) this.hubsLoading = true;
			try {
				return await this.fetchHubs(include);
			} finally {
				this.hubLoadsInFlight--;
				this.hubsLoading = this.hubsLoading && this.hubLoadsInFlight > 0;
			}
		},

		/**
		 * Fetch the hub info of every hub PHC advertises that passes `include`, and add it to the
		 * hubs store. Shared by the pinned-hub and discover paths so the url handling below cannot
		 * diverge between them again. A network error only propagates when there is nothing to show.
		 *
		 * @returns whether PHC answered, rather than only the copy on this device being shown.
		 */
		async fetchHubs(include: (item: HubInformation) => boolean): Promise<boolean> {
			const mss = useMSS();
			const hubsStore = useHubs();
			const hadHubs = hubsStore.hasHubs;
			try {
				const data = await mss.getHubs();
				hubsStore.retainHubs(data.map((item) => item.id));
				const hubPromises = data.filter(include).map((item) => {
					// PHC advertises hub urls with `/_synapse/client/` attached, while the endpoints in
					// `hub_api.apiURLS` carry that prefix themselves, so it is stripped here.
					const serverUrl = item.url.replace(/\/_synapse\/client\/?$/, '/');
					return mss
						.getHubInfo(serverUrl)
						.then((hubInfo) => {
							const hub = new Hub(item.id, item.name, hubInfo.hub_client_url, serverUrl, item.description);
							// Add the hub to the store here already so an offline hub cant delay the loading of online hubs.
							hubsStore.addHub(hub);
						})
						.catch((error) => {
							logger.error(`Could not fetch hub info for hub '${item.name}' with url ${item.url}: ${error.message}`);
						});
				});
				await Promise.all(hubPromises);
				return true;
			} catch (error) {
				if (!(hadHubs && isNetworkError(error))) throw error;
				logger.warn('PHC is unreachable; showing the hubs cached on this device', error);
				return false;
			}
		},

		existsInPinnedHubs(hubId: string) {
			if (!this.pinnedHubs) return false;
			const found = this.pinnedHubs.find((hub) => hub.hubId === hubId);
			return found;
		},

		getAuthInfo(hubId: string) {
			const hub = this.pinnedHubs.find((hub) => hub.hubId === hubId);
			if (!hub) {
				return null;
			}
			const accessToken = hub.accessToken;
			const userId = hub.userId;
			if (accessToken === undefined || userId === undefined) {
				return null;
			}
			return { token: accessToken, userId };
		},

		showModal() {
			this.modalVisible = true;
		},

		hideModal() {
			this.modalVisible = false;
		},

		setHubCanGoBack(canGoBack: boolean) {
			this.hubCanGoBack = canGoBack;
		},
	},
});

export { hasSession, useGlobal, type GlobalSettings, type PinnedHub, type PinnedHubs };
