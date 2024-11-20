import { defineStore } from 'pinia';

import { api } from '@/core/api';
import { Hub, HubList, Theme, TimeFormat, useSettings } from '@/store/store';
import { SMI } from '../../../hub-client/src/dev/StatusMessage';
import { Logger } from '@/../../hub-client/src/foundation/Logger';
import { CONFIG } from '../../../hub-client/src/foundation/Config';

type PinnedHub = {
	hubId: string;
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
			try {
				const data = await api.api<GlobalSettings | boolean>(api.apiURLS.bar, api.options.GET, defaultGlobalSettings);
				if (!data) {
					return false;
				}

				this.setGlobalSettings(data);
				this.loggedIn = true;
				return true;
			} catch (error) {
				console.error('failure getting global settings from server: ', error);
				return false;
			}
		},

		setGlobalSettings(data: any) {
			this.logger.log(SMI.STARTUP_TRACE, 'setGlobalSettings', data);
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

		logout() {
			// This will work now, since we redirect away with the 'window.location.refresh' but if we didn't need to make components reactive to the 'loggedIn' state.
			this.loggedIn = false;
			// This does not actually invalidate the previously stored access tokens. We should call logout on the hubs in the future.
			localStorage.clear();
			window.location.replace(api.apiURLS.logout);
		},

		// Will be called after each relevant change in state (watched in App.vue)
		async saveGlobalSettings() {
			if (this.loggedIn) {
				await api.apiPUT<any>(api.apiURLS.bar, this.getGlobalSettings, true);
			}
		},

		addPinnedHub(hub: PinnedHub, order: number = -1) {
			if (!this.pinnedHubs) {
				this.pinnedHubs = [] as PinnedHubs;
			}
			// make sure the hub is flattend, we only need the hubId
			hub = { hubId: hub.hubId };
			if (order < 0 || order > this.pinnedHubs.length) {
				this.pinnedHubs.push(hub);
			} else {
				this.pinnedHubs.splice(order, 0, hub);
			}
		},

		removePinnedHub(order: number) {
			this.pinnedHubs.splice(order, 1);
		},

		async getHubs() {
			const data = await api.apiGET<Array<hubResponseItem>>(api.apiURLS.hubs, []);
			const hubs = [] as HubList;
			data.forEach((item: hubResponseItem) => {
				hubs.push(new Hub(item.name, item.client_uri, item.server_uri, item.description));
			});
			return hubs;
		},

		existsInPinnedHubs(hubId: string) {
			if (!this.pinnedHubs) return false;
			const found = this.pinnedHubs.find((hub) => hub.hubId === hubId);
			return found;
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
