/**
 *
 * Specific hub API
 *
 */

import { Api } from '../../../hub-client/src/core/apiCore';

// @ts-ignore
const api = new Api(_env.PUBHUBS_URL, {
	login: 'login',
	logout: 'logout',
	bar: 'bar/state',
	hubs: 'bar/hubs',
});

export { api };
