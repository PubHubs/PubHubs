// Package imports
import { Pinia } from 'pinia';

// Global imports
import { useSettings } from '@/logic/store/store.js';
import { hub_api } from '@/logic/core/api.js';
import { EnterCompleteResp, EnterStartResp, HubEnterCompleteReq, HubEnterCompleteResp, HubEnterStartResp } from '@/model/MSS/TMultiServerSetup.js';
import { requestOptions, handleErrors } from '@/model/MSS/Auths.js';

// Hub imports
import { FeatureFlag, SettingsStore } from '@/../../hub-client/src/logic/store/settings.js';
import { HubSettingsJSONParser } from '@/../../hub-client/src/logic/store/json-utility.js';

// Logging
import { LOGGER } from '@/main.js';
import { SMI } from '@/logic/foundation/StatusMessage.js';

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
		// TODO change the description value here to the fetched summary
		if (this.settingsStore.isFeatureEnabled(FeatureFlag.hubSettings)) {
			return await hub_api.apiGET(`${this.serverUrl}${hub_api.apiURLS.hubSettingsUrl}`);
		} else {
			return undefined;
		}
	}

	public async enterStartEP() {
		const enterStartRespFn = () => hub_api.api<HubEnterStartResp>(`${this.serverUrl}${hub_api.apiURLS.enterStart}`, { method: 'POST' });
		const okEnterStartResp = await handleErrors<EnterStartResp>(enterStartRespFn);
		return okEnterStartResp;
	}

	public async enterCompleteEP(state: string, hhpp: string) {
		const requestPayload: HubEnterCompleteReq = { state, hhpp };
		const enterCompleteRespFn = () => hub_api.api<HubEnterCompleteResp>(`${this.serverUrl}${hub_api.apiURLS.enterComplete}`, requestOptions<HubEnterCompleteReq>(requestPayload));
		const okEnterCompleteResp = await handleErrors<EnterCompleteResp>(enterCompleteRespFn);
		if (okEnterCompleteResp === 'RetryFromStart') {
			return okEnterCompleteResp;
		} else {
			return okEnterCompleteResp.Entered;
		}
	}
}

// Array of Hubs
interface HubList extends Array<Hub> {}

export { Hub, HubList };
