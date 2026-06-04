// Packages
import { defineStore } from 'pinia';

// Logic
import { LocalStores } from '@global-client/logic/utils/localStore';

import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useMSS } from '@global-client/stores/mss';

const logger = createLogger('localStores');

/**
 * Singleton holder for the per-user LocalStores. Lazy-created in retrieve()
 * once the user is logged in and the secret is available; dropped in clear()
 * on logout. Callbacks should call retrieve() at message-arrival time so they
 * always read the current instance — this isolates them from the
 * login → logout → login lifecycle.
 *
 * Setup syntax is used so `instance` lives in closure scope rather than store
 * state — callers must go through retrieve() to access it.
 */
const useLocalStores = defineStore('localStores', () => {
	let instance: LocalStores | null = null;

	async function retrieve(): Promise<LocalStores | null> {
		if (instance) return instance;
		if (!useGlobal().loggedIn) {
			logger.warn('retrieve() called while not logged in — LocalStore unavailable');
			return null;
		}
		const info = await useMSS().phcServer.getUserSecretInfo();
		if (!info) {
			logger.warn('retrieve() called but user secret unavailable — LocalStore unavailable (logout procedure triggered)');
			return null;
		}
		instance = new LocalStores(info.userSecret);
		return instance;
	}

	function clear(): void {
		instance = null;
	}

	return { retrieve, clear };
});

export { useLocalStores };
