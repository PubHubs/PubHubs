// Package imports
import { Pinia } from 'pinia';

// Global imports
import { useSettings } from '@/logic/store/store';
import { hub_api } from '@/logic/core/api';

// Hub imports
import { FeatureFlag, SettingsStore } from '../../../hub-client/src/logic/store/settings';
import { HubSettingsJSONParser } from '../../../hub-client/src/logic/store/json-utility';

class Hub {
	readonly hubId: string;
	readonly hubName: string;
	readonly url: string;
	readonly serverUrl: string;
	description: string;
	logo: string;
	unreadMessages: number;

	private settingsStore: SettingsStore;

	constructor(hubId: string, hubName: string, url: string, serverUrl: string, description?: string, pinia?: Pinia) {
		this.hubId = hubId;
		this.hubName = hubName;
		this.url = url;
		this.serverUrl = serverUrl;
		if (typeof description !== 'undefined') {
			this.description = description;
		} else {
			this.description = hubId;
		}
		this.logo = '';
		this.unreadMessages = 0;

		if (pinia) {
			// Needed in testing
			this.settingsStore = useSettings(pinia);
		} else {
			this.settingsStore = useSettings();
		}
	}

	public get name(): string {
		return this.hubName;
	}

	public get iconUrlLight(): string {
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return `${this.serverUrl}${hub_api.apiURLS.iconLight}`;
		} else {
			return `${this.url}/img/logo.svg`;
		}
	}

	public get iconUrlDark(): string {
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return `${this.serverUrl}${hub_api.apiURLS.iconUrlDark}`;
		} else {
			return `${this.url}/img/logo-dark.svg`;
		}
	}
	public get bannerUrl(): string {
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return `${this.serverUrl}${hub_api.apiURLS.bannerUrl}`;
		} else {
			return `${this.url}/img/banner.svg`;
		}
	}
	public async getHubJSON(): Promise<HubSettingsJSONParser | undefined> {
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return await hub_api.apiGET(`${this.serverUrl}${hub_api.apiURLS.hubSettingsUrl}`);
		} else {
			return undefined;
		}
	}
}

// Array of Hubs
interface HubList extends Array<Hub> {}

export { Hub, HubList };
