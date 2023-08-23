/**
 *
 * Specific hub API
 *
 */

import { Api } from '@/core/apiCore';

// @ts-ignore
const api = new Api(_env.HUB_URL + '/_synapse/client', {
	securedRooms: 'secured_rooms',
});

export { api };
