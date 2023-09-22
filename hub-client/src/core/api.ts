/**
 *
 * Specific hub API
 *
 */

import { Api } from '@/core/apiCore';

// @ts-ignore
const api_synapse = new Api(_env.HUB_URL + '/_synapse', {
	securedRooms: 'client/secured_rooms',
	deleteRoom: 'admin/v2/rooms/',
});

// @ts-ignore
const api_matrix = new Api(_env.HUB_URL + '/_matrix', {
	rooms: 'client/v3/rooms/',
});

export { api_synapse, api_matrix };
