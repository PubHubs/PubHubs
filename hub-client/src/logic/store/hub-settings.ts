/**
 * This store has some specific settings only needed for the hub-client
 */

import { Message, useMessageBox } from '@/logic/store/store';
import { defineStore } from 'pinia';
import { MessageType } from './messagebox';
import { api_synapse } from '@/logic/core/api';
import { FeatureFlag, Theme, useSettings } from './settings';

type HubInformation = {
	name: string;
};

type HubSettingsState = {
	_hub: HubInformation | undefined;
	parentUrl: string;
	hubUrl: string;
	isSolo: boolean;
	mobileHubMenu: boolean;
	_iconUrl: string;
	_iconUrlDark: string;
};

export const ALLOWED_HUB_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
export const MAX_HUB_ICON_SIZE = 5000000; // ~5MB

const useHubSettings = defineStore('hub-settings', {
	state: (): HubSettingsState => {
		return {
			_hub: undefined,
			// @ts-ignore
			parentUrl: _env.PARENT_URL,
			// @ts-ignore
			hubUrl: _env.HUB_URL,
			isSolo: window.self === window.top,
			mobileHubMenu: true,
			_iconUrl: api_synapse.apiURLS.hubIcon,
			_iconUrlDark: api_synapse.apiURLS.hubIconDark,
		};
	},

	getters: {
		hubName(): string | undefined {
			return this._hub?.name;
		},

		iconUrlActiveTheme(): string {
			const settings = useSettings();
			switch (settings.getActiveTheme) {
				case Theme.Light:
					return this.iconUrlLight;
				case Theme.Dark:
					return this.iconUrlDark;
			}
		},

		iconDefaultUrlActiveTheme(): string {
			const settings = useSettings();
			switch (settings.getActiveTheme) {
				case Theme.Light:
					return this.iconDefaultUrl;
				case Theme.Dark:
					return this.iconDefaultDarkUrl;
			}
		},

		iconUrlLight(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return this._iconUrl;
			} else {
				return '/img/logo.svg';
			}
		},

		iconUrlDark(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return this._iconUrlDark;
			} else {
				return '/img/logo-dark.svg';
			}
		},

		iconDefaultUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubIconDefault;
			} else {
				return '/img/logo.svg';
			}
		},

		iconDefaultDarkUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubIconDefaultDark;
			} else {
				return '/img/logo-dark.svg';
			}
		},

		hubInfo(): HubInformation | undefined {
			return this._hub;
		},
	},
	actions: {
		hideBar() {
			this.mobileHubMenu = false;
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.BarHide));
		},

		initHubInformation(hub: HubInformation) {
			this._hub = hub;
		},

		async setIcon(image: File) {
			await api_synapse.uploadImage(api_synapse.apiURLS.hubIcon, image);
		},

		async deleteIcon() {
			await api_synapse.apiDELETE(api_synapse.apiURLS.hubIcon);
		},
	},
});

export { useHubSettings, HubInformation };
