// Packages
import { defineStore } from 'pinia';

// Logic
import { api } from '@global-client/logic/core/api';

import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { Hub } from '@global-client/models/Hubs';
import { type HubInformation } from '@global-client/models/MSS/TPHC';

// Stores
import { useHubs } from '@global-client/stores/hubs';
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

const logger = createLogger('Global');

const useGlobal = defineStore('global', {
	state: () => {
		return {
			loggedIn: false,
			modalVisible: false,
			contextMenuModalVisible: false,
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
			return state.modalVisible || state.contextMenuModalVisible;
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
		 * Concurrent callers share one check. The router guard runs this on every navigation while
		 * App.vue needs its result on mount, and two runs in parallel would both reset `loggedIn` and
		 * overwrite `pinnedHubs` from separate fetches. The promise is dropped once it settles, so a
		 * later navigation still re-checks.
		 */
		checkLoginAndSettings(): Promise<boolean> {
			this.loginCheck ??= this.loadLoginAndSettings().finally(() => {
				this.loginCheck = null;
			});
			return this.loginCheck;
		},

		async loadLoginAndSettings(): Promise<boolean> {
			this.loggedIn = false;

			const mss = useMSS();
			try {
				// If no authToken is stored in localstorage, this means the user is not logged in.
				if (!localStorage.getItem('PHauthToken')) {
					return false;
				}
				let settingsUserObject = null;
				try {
					settingsUserObject = await mss.requestUserObject('globalsettings');
				} catch (error) {
					logger.error('Failure getting global settings from server, attempting to load default settings', error);
				}
				let data: GlobalSettings;
				if (settingsUserObject) {
					data = JSON.parse(settingsUserObject) as GlobalSettings;
				} else {
					data = defaultGlobalSettings;
				}
				await this.setGlobalSettings(data);

				this.loggedIn = true;
				return true;
			} catch (error) {
				logger.error('Failure to set global settings', error);
				// Remove PHauthToken and userSecret from local storage in case the enterEP did successfully return an authToken for the user
				localStorage.removeItem('PHauthToken');
				localStorage.removeItem('UserSecret');
				localStorage.removeItem('UserSecretVersion');
				return false;
			}
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
			// Check if the hubName has changed since the last update of the global settings object.
			const hubs = await mss.getHubs();
			data.hubs.forEach((hub: PinnedHub) => {
				const hubName = hubs.find((hubRespItem) => hubRespItem.id === hub.hubId)?.name;
				if (hubName) {
					hub.hubName = hubName;
				}
			});
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
			try {
				if (!this.loggedIn) {
					return;
				}
				const mss = useMSS();
				await mss.storeUserObject<GlobalSettings>('globalsettings', this.getGlobalSettings);
			} catch (error) {
				// @ts-expect-error -- router is injected as plugin, not in store type
				this.router.push({ name: 'error' });
				logger.error(String(error));
			}
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
				this.pinnedHubsLoad = this.loadHubs((item) => pinnedHubIds.has(item.id));
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
		 * rather than set and cleared by each of them in turn.
		 */
		async loadHubs(include: (item: HubInformation) => boolean = () => true) {
			this.hubLoadsInFlight++;
			this.hubsLoading = true;
			try {
				await this.fetchHubs(include);
			} finally {
				this.hubLoadsInFlight--;
				this.hubsLoading = this.hubLoadsInFlight > 0;
			}
		},

		/**
		 * Fetch the hub info of every hub PHC advertises that passes `include`, and add it to the
		 * hubs store. Shared by the pinned-hub and discover paths so the url handling below cannot
		 * diverge between them again.
		 */
		async fetchHubs(include: (item: HubInformation) => boolean) {
			const mss = useMSS();
			const hubsStore = useHubs();
			const data = await mss.getHubs();
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

		showContextMenuModal() {
			this.contextMenuModalVisible = true;
		},

		hideContextMenuModal() {
			this.contextMenuModalVisible = false;
		},

		setHubCanGoBack(canGoBack: boolean) {
			this.hubCanGoBack = canGoBack;
		},
	},
});

export { useGlobal, type GlobalSettings, type PinnedHub, type PinnedHubs };
