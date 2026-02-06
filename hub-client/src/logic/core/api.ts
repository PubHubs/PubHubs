// Logic
import { Api } from '@hub-client/logic/core/apiCore';
import { CONFIG } from '@hub-client/logic/logging/Config';

const BASE_URL = CONFIG._env.HUB_URL;

const api_synapse = new Api(BASE_URL + '/_synapse/', {
	// Client APIs
	securedRooms: 'client/secured_rooms',
	notice: 'client/notices',
	securedRoom: 'client/srextra',

	// User admin API
	usersAPIV1: 'admin/v1/users/',
	usersAPIV2: 'admin/v2/users/',
	usersAPIV3: 'admin/v3/users/',

	// User room
	roomsAPIV1: 'admin/v1/rooms/',
	roomsAPIV2: 'admin/v2/rooms/',

	// Hub settings
	hub: 'client/hub',
	hubLogo: 'client/hublogo',
	hubSettings: 'client/hub/settings',
	hubIcon: 'client/hub/icon',
	hubIconDark: 'client/hub/icon/dark',
	hubIconDefault: 'client/hub/default-icon',
	hubIconDefaultDark: 'client/hub/default-icon/dark',
	hubBanner: 'client/hub/banner',
	hubBannerDefault: 'client/hub/default-banner',

	// Hub data
	data: 'client/hub/data',
});

const api_matrix = new Api(BASE_URL + '/_matrix', {
	rooms: 'client/v3/rooms/',
	join: 'client/v3/join/',
});

export { api_matrix, api_synapse };
