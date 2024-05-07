import { defineStore } from 'pinia';
import { getCookie } from 'typescript-cookie';

import { Hub, HubList, Theme, TimeFormat, useSettings } from '@/store/store';
import { api } from '@/core/api';

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
		async checkLoginAndSettings() {
			this.loggedIn = false;
			try {
				const data = await api.api<GlobalSettings | boolean>(api.apiURLS.bar, api.options.GET, defaultGlobalSettings);
				if (!data) {
					return false;
				}

				this.setGlobalSettings(data);
				const loginTime = getCookie('PHAccount.LoginTimestamp');
				if (!loginTime) {
					// I don't expect this to happen, as PubHubs central should have added
					// the PHAccount.LoginTimestamp when it is missing.
					console.error('Logged in, but PHAccount.LoginTimestamp cookie not set! Please remove all PHAccount cookies, and log in again.');
					return false; // Prevents logout-login loop, see #572
				}
				this.loginTime = loginTime;
				this.loggedIn = true;
				return true;
			} catch (error) {
				console.error('failure getting global settings from server or login timestamp cookie: ', error);
				return false;
			}
		},

		setGlobalSettings(data: any) {
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

		login() {
			window.location.replace(api.apiURLS.login);
		},

		logout() {
			this.loggedIn = false;
			window.location.replace(api.apiURLS.logout);
		},

		// Will be called after each change in state (subscribed in App.vue)
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
				hubs.push(new Hub(item.name, item.client_uri, item.description));
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
