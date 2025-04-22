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
const hub_api = new Api('/', {
	hubSettingsUrl: '_synapse/client/hub/settings',
	iconLight: '_synapse/client/hub/icon',
	iconUrlDark: '_synapse/client/hub/icon/dark',
	bannerUrl: '_synapse/client/hub/banner',
});

export { api, hub_api };
