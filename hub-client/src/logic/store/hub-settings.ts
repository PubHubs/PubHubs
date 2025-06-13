/**
 * This store has some specific settings only needed for the hub-client
 */

import { Message, useMessageBox } from '@/logic/store/store';
import { defineStore } from 'pinia';
import { MessageType } from './messagebox';
import { api_synapse } from '@/logic/core/api';
import { FeatureFlag, Theme, useSettings } from './settings';
import { HubSettingsJSONParser } from '@/logic/store/json-utility';

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
				return api_synapse.apiURLS.hubIcon;
			} else {
				return '/img/logo-person.svg';
			}
		},

		iconUrlDark(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubIconDark;
			} else {
				return '/img/logo-person-dark.svg';
			}
		},

		iconDefaultUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubIconDefault;
			} else {
				return '/img/logo-person.svg';
			}
		},

		iconDefaultDarkUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubIconDefaultDark;
			} else {
				return '/img/logo-person-dark.svg';
			}
		},

		bannerUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubBanner;
			} else {
				return '/img/banner.svg';
			}
		},

		bannerDefaultUrl(): string {
			const settings = useSettings();

			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				return api_synapse.apiURLS.hubBannerDefault;
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
			await api_synapse.uploadImage(api_synapse.apiURLS.hubIcon, image);
		},

		async deleteIcon() {
			await api_synapse.apiDELETE(api_synapse.apiURLS.hubIcon);
		},
		async setBanner(image: File) {
			await api_synapse.uploadImage(api_synapse.apiURLS.hubBanner, image);
		},

		async deleteBanner() {
			await api_synapse.apiDELETE(api_synapse.apiURLS.hubBanner);
		},
		async getHubJSON(): Promise<HubSettingsJSONParser | undefined> {
			const settings = useSettings();
			if (settings.isFeatureEnabled(FeatureFlag.hubSettings)) {
				const response = await api_synapse.apiGET<HubSettingsJSONParser>(api_synapse.apiURLS.hubSettings);
				this._summary = response.summary;
				this._description = response.description;
				this._contact = response.contact;
				this._consent = response.consent;
				this._version = response.version;
				return response;
			} else {
				return undefined;
			}
		},
		async setHubJSON(hubSettingsData: HubSettingsJSONParser) {
			await api_synapse.apiPOST(api_synapse.apiURLS.hubSettings, hubSettingsData);
		},
	},
});

export { useHubSettings, HubInformation };
