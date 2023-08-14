/**
 *
 * Specific hub API
 *
 */

import { apiOptionsGET, apiOptionsPOST, apiOptionsPUT, apiOptionsDELETE, useApi } from '../../../hub-client/src/core/apiCore';

let baseUrl = '';
// @ts-ignore
if (typeof _env !== 'undefined') {
	// @ts-ignore
	baseUrl = _env.PUBHUBS_URL;
}

const apiURLS = {
	login: baseUrl + '/login',
	logout: baseUrl + '/logout',
	bar: baseUrl + '/bar/state',
	hubs: baseUrl + '/bar/hubs',
};

export { apiURLS, apiOptionsGET, apiOptionsPOST, apiOptionsPUT, apiOptionsDELETE, useApi };
