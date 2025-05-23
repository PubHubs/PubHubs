/**
 *
 * Specific hub API
 *
 */

import { Api } from '@/logic/core/apiCore';

// This is needed so histoire can run (otherwise _env is undefined)
let BASE_URL = '';
// @ts-expect-error
if (typeof _env !== 'undefined') {
	// @ts-expect-error
	BASE_URL = _env.HUB_URL;
}

const api_synapse = new Api(BASE_URL + '/_synapse/', {
	// client APIs
	securedRooms: 'client/secured_rooms',
	notice: 'client/notices',
	securedRoom: 'client/srextra',

	// user admin API
	usersAPIV1: 'admin/v1/users/',
	usersAPIV2: 'admin/v2/users/',
	usersAPIV3: 'admin/v3/users/',

	// user room
	roomsAPIV1: 'admin/v1/rooms/',
	roomsAPIV2: 'admin/v2/rooms/',

	// hub settings
	hub: 'client/hub',
	hubLogo: 'client/hublogo',
	hubSettings: 'client/hub/settings',
	hubIcon: 'client/hub/icon',
	hubIconDark: 'client/hub/icon/dark',
	hubIconDefault: 'client/hub/default-icon',
	hubIconDefaultDark: 'client/hub/default-icon/dark',
	hubBanner: 'client/hub/banner',
	hubBannerDefault: 'client/hub/default-banner',
	users: 'client/hub/users',

	// hub consent
	consent: 'client/hub_consent',
});

const api_matrix = new Api(BASE_URL + '/_matrix', {
	rooms: 'client/v3/rooms/',
	join: 'client/v3/join/',
});

export { api_matrix, api_synapse };
