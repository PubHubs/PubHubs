/**
 *
 * Specific hub API
 *
 */

import { Api } from '@/core/apiCore';

// This is needed so histoire can run (otherwise _env is undefined)
let BASE_URL = '';
// @ts-ignore
if (typeof _env !== 'undefined') {
	// @ts-ignore
	BASE_URL = _env.HUB_URL;
}

// @ts-ignore
const api_synapse = new Api(BASE_URL + '/_synapse/', {
	securedRooms: 'client/secured_rooms',
	joinHub: 'client/hubjoined',
	deleteRoom: 'admin/v2/rooms/',
	notice: 'client/notices',
	securedRoom: 'client/srextra',
});

// @ts-ignore
const api_matrix = new Api(BASE_URL + '/_matrix', {
	rooms: 'client/v3/rooms/',
});

export { api_synapse, api_matrix };
