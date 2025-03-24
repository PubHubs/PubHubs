// Package imports
import { Pinia } from 'pinia';

// Global imports
import { useSettings } from '@/logic/store/store';

// Hub imports
import { FeatureFlag, SettingsStore } from '../../../hub-client/src/logic/store/settings';

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
			return `${this.serverUrl}_synapse/client/hub/icon`;
		} else {
			return `${this.url}/img/logo.svg`;
		}
	}

	public get iconUrlDark(): string {
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return `${this.serverUrl}_synapse/client/hub/icon/dark`;
		} else {
			return `${this.url}/img/logo-dark.svg`;
		}
	}
}

// Array of Hubs
interface HubList extends Array<Hub> {}

export { Hub, HubList };
