// Logic
import { Api } from '@hub-client/logic/core/apiCore';

const api = new Api(_env.PUBHUBS_URL, {
	login: 'login',
	loginEn: 'en/login',
	logout: 'logout',
});

const hub_api = new Api('_synapse', {
	hubSettingsUrl: 'client/hub/settings',
	iconLight: 'client/hub/icon',
	iconUrlDark: 'client/hub/icon/dark',
	bannerUrl: 'client/hub/banner',
	info: 'client/.ph/info',
	enterStart: 'client/.ph/enter-start',
	enterComplete: 'client/.ph/enter-complete',
});

const phc_api = _env.PHC_URL
	? new Api(_env.PHC_URL, {
			welcome: '.ph/user/welcome',
			enter: '.ph/user/enter',
			refresh: '.ph/user/refresh',
			state: '.ph/user/state',
			getObject: '.ph/user/obj/by-hash',
			newObject: '.ph/user/obj/by-handle',
			overwriteObject: '.ph/user/obj/by-hash',
			polymorphicPseudonymPackage: '.ph/user/ppp',
			HashedHubPseudonymPackage: '.ph/user/hhpp',
		})
	: null;

const auths_api = (authServerUrl: string) =>
	new Api(authServerUrl, {
		welcome: '.ph/welcome',
		authStart: '.ph/auth/start',
		authComplete: '.ph/auth/complete',
		attrKeys: '.ph/attr-keys',
	});

const tr_api = (transcryptorUrl: string) =>
	new Api(transcryptorUrl, {
		encryptedHubPseudonymPackage: '.ph/ehpp',
	});

export { api, auths_api, hub_api, phc_api, tr_api };
