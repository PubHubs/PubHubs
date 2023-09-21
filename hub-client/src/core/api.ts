/**
 *
 * Specific hub API
 *
 */

import { Api } from '@/core/apiCore';

// @ts-ignore
const api = new Api(_env.HUB_URL + '/_synapse/', {
	securedRooms: 'client/secured_rooms',
	deleteRoom: 'admin/v2/rooms/',
});

export { api };
