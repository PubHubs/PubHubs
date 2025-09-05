// Package imports
import { defineStore } from 'pinia';
import { assert } from 'chai';

// Global imports
import { api } from '@/logic/core/api.js';
import { useMSS } from '@/logic/store/mss.js';
import { FeatureFlag, Theme, TimeFormat, useSettings } from '@/logic/store/settings.js';
import { Hub, HubList } from '@/model/Hubs.js';

// Hub imports
import { SMI } from '@/../../hub-client/src/logic/foundation/StatusMessage.js';
import { Logger } from '@/../../hub-client/src/logic/foundation/Logger.js';
import { CONFIG } from '@/../../hub-client/src/logic/foundation/Config.js';

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
	theme: 'system', // Theme.System,
	timeformat: 'format24', // TimeFormat.format24,
	language: 'en',
	hubs: [] as PinnedHubs,
};

interface hubResponseItem {
	id: string;
	name: string;
	client_uri: string;
	server_uri: string;
	description: string;
}

const useGlobal = defineStore('global', {
	state: () => {
		return {
			loggedIn: false,
			modalVisible: false,
			pinnedHubs: [] as PinnedHubs,

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

			const settings = useSettings();
			if (settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
				const mss = useMSS();
				try {
					// If no authToken is stored in localstorage, this means the user is not logged in.
					if (!localStorage.getItem('PHauthToken')) {
						return false;
					}

					const settingsUserObject = await mss.requestUserObject('globalsettings');

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
					console.error('Failure getting global settings from server: ', error);
					// Remove PHauthToken and userSecret from local storage in case the enterEP did successfully return an authToken for the user
					localStorage.removeItem('PHauthToken');
					localStorage.removeItem('UserSecret');
					return false;
				}
			} else {
				try {
					const data = await api.api<ArrayBuffer | boolean>(api.apiURLS.bar, api.options.GET);
					if (!data) {
						return false;
					}

					let globalsettings: GlobalSettings;

					if (data === true || data.byteLength === 0) {
						globalsettings = defaultGlobalSettings;
					} else {
						const decoded = new TextDecoder().decode(data);
						try {
							globalsettings = JSON.parse(decoded);
						} catch {
							console.error('Could not decode the global settings.');
							return false;
						}
					}

					await this.setGlobalSettings(globalsettings);

					// Remove any accessTokens that are left in localStorage
					Object.keys(localStorage)
						.filter((key) => key.endsWith('accessToken'))
						.forEach((key) => localStorage.removeItem(key));

					this.loggedIn = true;
					return true;
				} catch (error) {
					console.error('failure getting global settings from server: ', error);
					return false;
				}
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
				data.language = navigator.language;
			}
			settings.setLanguage(data.language);

			if (!settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
				const checkHubData = data.hubs.reduce(
					(result: { updatedPinnedHubs: string[]; oldPinnedHubs: PinnedHubs }, hub: PinnedHub) => {
						if (hub.hubName !== undefined) {
							// If a hubName is present, the hub data is already in the updated formate.
							result.updatedPinnedHubs.push(hub.hubName);
						} else {
							result.oldPinnedHubs.push(hub);
						}
						return result;
					},
					{ updatedPinnedHubs: [], oldPinnedHubs: [] },
				);

				// If there are hubs in the old format (with the hubName stored as hubId), update the pinned hubs data to contain both the hubId and hubName.
				if (checkHubData.oldPinnedHubs.length > 0) {
					data.hubs = await this.updatePinnedHubs(data.hubs, checkHubData.updatedPinnedHubs);
				} else {
					// Check if the hubName has changed since the last update of /bar/state.
					const hubs = await api.apiGET<Array<hubResponseItem>>(api.apiURLS.hubs);
					data.hubs.forEach((hub: PinnedHub) => {
						const hubName = hubs.find((hubRespItem) => hubRespItem.id === hub.hubId)?.name;
						if (hubName !== undefined) {
							hub.hubName = hubName;
						}
					});
				}
				this.pinnedHubs = data.hubs;
			} else {
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
			}
		},

		async updatePinnedHubs(pinnedHubsData: PinnedHubs, upToDatePinnedHubNames: string[]) {
			const hubs = await api.apiGET<Array<hubResponseItem>>(api.apiURLS.hubs);
			const hubNames = hubs.map((hub) => hub.name);
			for (let i = pinnedHubsData.length - 1; i >= 0; i--) {
				const hub = pinnedHubsData[i];
				// A check is performed to see if the hubName is stored as the hubId (which was the case before fixing issue #1051).
				// If this is the case, the hubId corresponding to the hub with hubName is looked up and the hubName is overwritten by this hubId.
				if (hubNames.includes(hub.hubId) && upToDatePinnedHubNames.includes(hub.hubId)) {
					pinnedHubsData.splice(i, 1);
				} else if (hubNames.includes(hub.hubId)) {
					const hubId = hubs.find((hubRespItem) => hubRespItem.name === hub.hubId)?.id;
					// Check if the accessToken is stored in localStorage.
					// If this is the case, add the accessToken to the pinnedHubs and remove it from localStorage.
					const accessToken = localStorage.getItem(hub.hubId + 'accessToken');
					if (hubId && accessToken) {
						pinnedHubsData[i] = { hubId: hubId, hubName: hub.hubId, accessToken: accessToken };
						localStorage.removeItem(hub.hubId + 'accessToken');
					} else if (hubId) {
						pinnedHubsData[i] = { hubId: hubId, hubName: hub.hubId };
					} else {
						// If the hub with this hubName cannot be found, remove it from the pinnedHubs.
						pinnedHubsData.splice(i, 1);
					}
				}
				// Check if the hubName has changed since the last update of /bar/state.
				const hubName = hubs.find((hubRespItem) => hubRespItem.id === hub.hubId)?.name;
				if (hubName !== undefined) {
					hub.hubName = hubName;
				}
			}
			return pinnedHubsData;
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
			const settings = useSettings();
			// This will work now, since we redirect away with the 'window.location.refresh' but if we didn't need to make components reactive to the 'loggedIn' state.
			this.loggedIn = false;
			if (settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
				localStorage.removeItem('PHauthToken');
				localStorage.removeItem('UserSecret');
				// TODO: find a way router can be part of a store that TypeScript swallows.
				// @ts-ignore
				await this.router.replace({ name: 'home' });
			} else {
				window.location.replace(api.apiURLS.logout);
			}
		},

		// Will be called after each relevant change in state (watched in App.vue)
		async saveGlobalSettings() {
			try {
				if (!this.loggedIn) {
					return;
				}

				const settings = useSettings();
				if (!settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
					await api.apiPUT<any>(api.apiURLS.bar, this.getGlobalSettings, true);
					return;
				}

				assert.isTrue(settings.isFeatureEnabled(FeatureFlag.multiServerSetup));
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

		addAccessToken(hubId: string, accessToken: string) {
			const index = this.pinnedHubs.findIndex((hub) => hub.hubId === hubId);
			this.pinnedHubs[index].accessToken = accessToken;
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
			const settings = useSettings();
			if (!settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
				const data = await api.apiGET<Array<hubResponseItem>>(api.apiURLS.hubs);
				const hubs = [] as HubList;
				data.forEach((item: hubResponseItem) => {
					hubs.push(new Hub(item.id, item.name, item.client_uri, item.server_uri, item.description));
				});
				return hubs;
			} else {
				const mss = useMSS();
				const data = await mss.getHubs();
				const hubs = [] as HubList;
				for (const item of data) {
					// Strip /synapse/client from the serverurl
					const hubInfo = await mss.getHubInfo(item.url);
					const serverUrl = item.url.replace(/\/_synapse\/client/, '');
					hubs.push(new Hub(item.id, item.name, hubInfo.hub_client_url, serverUrl, item.description));
				}
				return hubs;
			}
		},

		existsInPinnedHubs(hubId: string) {
			if (!this.pinnedHubs) return false;
			const found = this.pinnedHubs.find((hub) => hub.hubId === hubId);
			return found;
		},

		getAccessToken(hubId: string) {
			const accessToken = this.pinnedHubs.find((hub) => hub.hubId === hubId)?.accessToken;
			if (accessToken === undefined) {
				return null;
			}
			return accessToken;
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
