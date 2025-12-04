// Packages
import { defineStore } from 'pinia';

// Logic
import { api } from '@global-client/logic/core/api';

import { CONFIG } from '@hub-client/logic/logging/Config';
import { Logger } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { Hub } from '@global-client/models/Hubs';

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
}

const defaultGlobalSettings = {
	theme: Theme.System,
	timeformat: TimeFormat.format24,
	language: 'nl', // Default language is set in `hub-client/src/i18n.ts`.
	hubs: [] as PinnedHubs,
};

const useGlobal = defineStore('global', {
	state: () => {
		return {
			loggedIn: false,
			modalVisible: false,
			pinnedHubs: [] as PinnedHubs,
			hubsLoading: false,

			logger: new Logger('GC', CONFIG),
		};
	},

	getters: {
		isModalVisible(state): Boolean {
			return state.modalVisible;
		},

		getGlobalSettings(state): GlobalSettings {
			const settings = useSettings();
			const globalSettings: GlobalSettings = {
				theme: settings.theme,
				timeformat: settings.getTimeFormat,
				language: settings.getActiveLanguage,
				hubs: state.pinnedHubs,
			};
			return globalSettings;
		},

		hasPinnedHubs(state): Boolean {
			if (!state.pinnedHubs) return false;
			return state.pinnedHubs.length > 0;
		},
	},

	actions: {
		/**
		 *
		 * @returns a promise that resolves to true if the user is logged in and the settings are loaded, false otherwise
		 */
		async checkLoginAndSettings() {
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
					console.error('Failure getting global settings from server, attempting to load default settings', error);
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
				console.error('Failure to set global settings', error);
				// Remove PHauthToken and userSecret from local storage in case the enterEP did successfully return an authToken for the user
				localStorage.removeItem('PHauthToken');
				localStorage.removeItem('UserSecret');
				localStorage.removeItem('UserSecretVersion');
				return false;
			}
		},

		async setGlobalSettings(data: any) {
			this.logger.log(SMI.STARTUP, 'setGlobalSettings', data);
			const settings = useSettings();
			settings.setTheme(data.theme);
			if (!data.timeformat || data.timeformat === '') {
				data.timeformat = TimeFormat.format24;
			}
			settings.setTimeFormat(data.timeformat);
			if (!data.language || data.language === '') {
				if (settings._i18n?.locale) {
					data.language = settings._i18n?.locale;
				} else {
					data.language = navigator.language;
				}
			}
			settings.setLanguage(data.language);

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

		login(language: string | 'en' | 'nl') {
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

		async logout() {
			this.loggedIn = false;

			const mss = useMSS();
			mss.logout();

			// TODO: find a way router can be part of a store that TypeScript swallows.
			// @ts-ignore
			await this.router.replace({ name: 'login' });
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
				// @ts-ignore
				this.router.push({ name: 'error' });
				this.logger.error(SMI.ERROR, String(error));
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

		async getHubs() {
			this.hubsLoading = true;
			const mss = useMSS();
			const hubsStore = useHubs();
			const data = await mss.getHubs();
			const hubPromises = data.map((item) =>
				mss
					.withTimeout(mss.getHubInfo(item.url), 2000) // ms
					.then((hubInfo) => {
						const serverUrl = item.url.replace(/\/_synapse\/client/, '');
						const hub = new Hub(item.id, item.name, hubInfo.hub_client_url, serverUrl, item.description);
						// Add the hub to the store here already so an offline hub cant delay the loading of online hubs.
						// TODO: update the flow after global.getHubs given that hubs are already added before the await.
						hubsStore.addHub(hub);
					})
					.catch((error) => {
						this.logger.error(SMI.ERROR, `Could not fetch hub info for hub '${item.name}' with url ${item.url}: ${error.message}`);
					}),
			);
			await Promise.all(hubPromises);
			this.hubsLoading = false;
		},

		setLoadingHubs(value: boolean) {
			this.hubsLoading = value;
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
	},
});

export { useGlobal, type PinnedHub, type PinnedHubs };
