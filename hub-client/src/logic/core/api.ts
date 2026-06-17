// Logic
import { Api } from '@hub-client/logic/core/apiCore';
import { CONFIG } from '@hub-client/logic/logging/Config';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';

const BASE_URL = CONFIG._env.HUB_URL;

let isReauthenticating = false;

/**
 * Handler for 401 Unauthorized responses.
 * Sends a message to the global-client to remove the invalid token and trigger re-authentication.
 * The global-client will reload the page, prompting the user to log in again.
 */
const handleUnauthorized = () => {
	// Prevent multiple re-authentication attempts
	if (isReauthenticating) return;
	isReauthenticating = true;

	useMessageBox().sendMessage(new Message(MessageType.RemoveAccessToken));
};

const api_synapse = new Api(BASE_URL + '/_synapse/', {
	// Client APIs
	securedRooms: 'client/secured_rooms',
	notice: 'client/notices',
	securedRoom: 'client/srextra',
	videoCall: 'client/videocall',

	// Client Steward APIs
	stewardSecuredRooms: 'client/steward/secured_rooms',
	stewardReports: 'client/steward/reports',

	// Client Hub settings
	hub: 'client/hub',
	hubLogo: 'client/hublogo',
	hubSettings: 'client/hub/settings',
	hubIcon: 'client/hub/icon',
	hubIconDark: 'client/hub/icon/dark',
	hubIconDefault: 'client/hub/default-icon',
	hubIconDefaultDark: 'client/hub/default-icon/dark',
	hubBanner: 'client/hub/banner',
	hubBannerDefault: 'client/hub/default-banner',

	// Client Hub data
	data: 'client/hub/data',

	// Synapse Admin APIs
	usersAPIV1: 'admin/v1/users/',
	usersAPIV2: 'admin/v2/users/',
	usersAPIV3: 'admin/v3/users/',
	APIV1: 'admin/v1/',
	roomsAPIV1: 'admin/v1/rooms/',
	roomsAPIV2: 'admin/v2/rooms/',
	eventReports: 'admin/v1/event_reports',
});

const api_matrix = new Api(BASE_URL + '/_matrix', {
	rooms: 'client/v3/rooms/',
	join: 'client/v3/join/',
});

// Set up 401 Unauthorized handlers to trigger re-authentication
api_synapse.setOnUnauthorized(handleUnauthorized);
api_matrix.setOnUnauthorized(handleUnauthorized);

export { api_matrix, api_synapse };
