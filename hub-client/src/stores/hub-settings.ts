/**
 * This store has some specific settings only needed for the hub-client
 */
// Packages
import { defineStore } from 'pinia';

// Logic
import { api_synapse as api } from '@hub-client/logic/core/api';
import { HubSettingsJSONParser } from '@hub-client/logic/json-utility';
import { CONFIG } from '@hub-client/logic/logging/Config';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { FeatureFlag, Theme, useSettings } from '@hub-client/stores/settings';

// Types
type HubInformation = {
	name: string;
};

type HubSettingsState = {
	_hub: HubInformation | undefined;
	parentUrl: string;
	hubUrl: string;
	isSolo: boolean;
	mobileHubMenu: boolean;
	_summary: string;
	_description: string;
	_contact: string;
	_consent: string;
	_version: number;
};

export const toolbarSettings = {
	bold: true,
	italic: true,
	header: true,
	underline: true,
	strikethrough: true,
	mark: true,
	superscript: true,
	subscript: true,
	quote: true,
	ol: true,
	ul: true,
	link: true,
	imagelink: false,
	code: true,
	table: true,
	fullscreen: false,
	readmodel: false,
	htmlcode: true,
	help: false,
	undo: true,
	redo: true,
	trash: true,
	save: false,
	navigation: false,
	alignleft: true,
	aligncenter: true,
	alignright: true,
	subfield: true,
	preview: true,
};

export const ALLOWED_HUB_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
export const MAX_HUB_ICON_SIZE = 5000000; // ~5MB

const useHubSettings = defineStore('hub-settings', {
	state: (): HubSettingsState => {
		return {
			_hub: undefined,
			// @ts-ignore
			parentUrl: CONFIG._env.PARENT_URL,
			// @ts-ignore
			hubUrl: CONFIG._env.HUB_URL,
			isSolo: window.self === window.top,
			mobileHubMenu: true,
			_summary: '',
			_description: '',
			_contact: '',
			_consent: '',
			_version: 1,
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
				return api.apiURLS.hubIcon;
			} else {
				return '/img/logo-person.svg';
			}
		},

		iconUrlDark(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api.apiURLS.hubIconDark;
			} else {
				return '/img/logo-person-dark.svg';
			}
		},

		iconDefaultUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api.apiURLS.hubIconDefault;
			} else {
				return '/img/logo-person.svg';
			}
		},

		iconDefaultDarkUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api.apiURLS.hubIconDefaultDark;
			} else {
				return '/img/logo-person-dark.svg';
			}
		},

		bannerUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api.apiURLS.hubBanner;
			} else {
				return '/img/banner.svg';
			}
		},

		bannerDefaultUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api.apiURLS.hubBannerDefault;
			} else {
				return '/img/banner.svg';
			}
		},

		hubInfo(): HubInformation | undefined {
			return this._hub;
		},
		hubDescription(): string {
			return this._description;
		},
		hubSummary(): string {
			return this._summary;
		},
		hubContact(): string {
			return this._contact;
		},
		hubConsent(): string {
			return this._consent;
		},
		hubConsentVersion(): number {
			return this._version;
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
			await api.uploadImage(api.apiURLS.hubIcon, image);
		},

		async deleteIcon() {
			await api.apiDELETE(api.apiURLS.hubIcon);
		},
		async setBanner(image: File) {
			await api.uploadImage(api.apiURLS.hubBanner, image);
		},

		async deleteBanner() {
			await api.apiDELETE(api.apiURLS.hubBanner);
		},
		async getHubJSON(): Promise<HubSettingsJSONParser | undefined> {
			const settings = useSettings();
			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				const response = await api.apiGET<HubSettingsJSONParser>(api.apiURLS.hubSettings);
				this._summary = response.summary;
				this._description = response.description;
				this._contact = response.contact;
				this._consent = response.consent;
				this._version = response.version ?? 1;
				return response;
			} else {
				return undefined;
			}
		},
		async setHubJSON(hubSettingsData: HubSettingsJSONParser) {
			await api.apiPOST(api.apiURLS.hubSettings, hubSettingsData);
		},
	},
});

export { useHubSettings, HubInformation };
