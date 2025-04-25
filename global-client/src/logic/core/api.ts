/**
 *
 * Specific hub API
 *
 */

import { Api } from '../../../../hub-client/src/logic/core/apiCore';

// @ts-ignore
const api = new Api(_env.PUBHUBS_URL, {
	login: 'login',
	loginEn: 'en/login',
	logout: 'logout',
	bar: 'bar/state',
	hubs: 'bar/hubs',
});
const hub_api = new Api('_synapse', {
	hubSettingsUrl: 'client/hub/settings',
	iconLight: 'client/hub/icon',
	iconUrlDark: 'client/hub/icon/dark',
	bannerUrl: 'client/hub/banner',
});

export { api, hub_api };
