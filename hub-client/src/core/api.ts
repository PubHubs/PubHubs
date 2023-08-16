/**
 *
 * Specific hub API
 *
 */

import { apiOptionsGET, apiOptionsPOST, apiOptionsPUT, apiOptionsDELETE, useApi } from '@/core/apiCore';

let baseUrl = '';
// @ts-ignore
if (typeof _env !== 'undefined') {
	// @ts-ignore
	baseUrl = _env.HUB_URL + '/_synapse/client/';
}

const apiURLS = {
	securedRooms: baseUrl + 'secured_rooms',
};

export { apiURLS, apiOptionsGET, apiOptionsPOST, apiOptionsPUT, apiOptionsDELETE, useApi };
