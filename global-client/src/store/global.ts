import { defineStore } from 'pinia';
import { getCookie } from 'typescript-cookie';
import { Buffer } from 'buffer';

import { Hub, HubList } from '@/store/hubs';
import { apiOptionsGET, apiURLS, useApi } from '@/store/api';
import { Theme, useSettings } from './settings';

type PinnedHub = {
	hubId: string;
};

type PinnedHubs = Array<PinnedHub>;

interface GlobalSettings {
	theme: Theme;
	language: string;
	hubs: PinnedHubs;
}

const defaultGlobalSettings = {
	theme: Theme.System,
	language: 'en',
	hubs: [] as PinnedHubs,
};

interface hubResponseItem {
	name: string;
	client_uri: string;
	description: string;
}

const useGlobal = defineStore('global', {
	state: () => {
		return {
			loggedIn: false,
			modalVisible: false,
			pinnedHubs: [] as PinnedHubs,
			loginTime: '',
		};
	},

	getters: {
		isModalVisible(state): Boolean {
			return state.modalVisible;
		},

		getGlobalSettings(state): GlobalSettings {
			const settings = useSettings();
			const globalSettings: GlobalSettings = {
				theme: settings.getActiveTheme,
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
		async checkLoginAndSettings() {
			const api = useApi();
			try {
				const data = await api.api<GlobalSettings | boolean>(apiURLS.bar, apiOptionsGET, defaultGlobalSettings);
				if (data) {
					this.setGlobalSettings(data);
					this.loggedIn = true;
					if (getCookie('PHAccount')) {
						const base64Cookie = getCookie('PHAccount') as string; // see docs/API.md
						this.loginTime = Buffer.from(base64Cookie, 'base64').toString('binary').split('.')[1];
					}
					return true;
				} else {
					this.loggedIn = false;
					return false;
				}
			} catch (error) {
				this.loggedIn = false;
				return false;
			}
		},

		setGlobalSettings(data: any) {
			const settings = useSettings();
			settings.setTheme(data.theme);
			if (!data.language || data.language == '') {
				data.language = navigator.language;
			}
			settings.setLanguage(data.language);
			this.pinnedHubs = data.hubs;
		},

		login() {
			window.location.replace(apiURLS.login);
		},

		logout() {
			this.loggedIn = false;
			window.location.replace(apiURLS.logout);
		},

		// Will be called after each change in state (subscribed in App.vue)
		async saveGlobalSettings() {
			if (this.loggedIn) {
				const api = useApi();
				await api.apiPUT<any>(apiURLS.bar, this.getGlobalSettings, true);
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
			const api = useApi();
			const data = await api.apiGET<Array<hubResponseItem>>(apiURLS.hubs,[]);
			const hubs = [] as HubList;
			data.forEach((item: hubResponseItem) => {
				hubs.push(new Hub(item.name, item.client_uri, item.description));
			});
			return hubs;
		},

		existsInPinnedHubs(hubId: string) {
			if (!this.pinnedHubs) return false;
			const found = this.pinnedHubs.find((hub) => hub.hubId == hubId);
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
