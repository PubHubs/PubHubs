// Packages
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router';

// Composables
import { useMiniclientGate } from '@global-client/composables/miniclientGate.composable';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

import { useSettings } from '@hub-client/stores/settings';

const logger = createLogger('NavigationGuard');

/**
 * Builds the global client's navigation guard.
 */
const createNavigationGuard = () => {
	// The hub the user last visited is restored at most once per page load, on the first navigation
	// that runs as a logged-in user.
	let restoredLastVisitedHub = false;

	return async (to: RouteLocationNormalized, from: RouteLocationNormalized): Promise<RouteLocationRaw | undefined> => {
		if (to.name === 'error' && from.name === undefined) {
			return { name: 'hubs-overview' };
		}

		const global = useGlobal();
		// The settings are loaded once per session; later navigations need no round trip to PHC.
		const isLoggedIn = global.loggedIn || (await global.checkLoginAndSettings());
		if (isLoggedIn) {
			const load = global.getPinnedHubsData().catch((error) => logger.error('Could not load the pinned hubs', { error }));
			// The hub page looks its hub up in the hubs store, so the navigation waits while a pinned hub
			// is missing there. Otherwise (usually thanks to the copy on this device) the load, which waits
			// for PHC and every pinned hub, refreshes them in the background.
			const hubs = useHubs();
			if (global.pinnedHubs.some((hub) => !hubs.hubExists(hub.hubId))) await load;
		}
		if (to.meta.requiresAuth && !isLoggedIn) {
			restoredLastVisitedHub = false;
			const redirectPath = to.fullPath;
			return { name: 'login', query: redirectPath === '/' ? {} : { redirect: redirectPath } };
		}

		if (!restoredLastVisitedHub && isLoggedIn) {
			restoredLastVisitedHub = true;
			if (to.name === 'hubs-overview') {
				const lastHub = global.pinnedHubs.find((hub) => hub.hubId === useSettings().getLastVisitedHub);
				if (lastHub) {
					return { name: 'hub', params: { name: lastHub.hubName } };
				}
			}
		}

		// Routes that do not load the hub-client have nothing to wait for.
		// Last in the guard on purpose: a navigation that redirects away, into a hub or to
		// the login page, never lands on such a page and must not release the miniclienrs.
		if (to.meta.releasesMiniclients) {
			const { releaseMiniclients } = useMiniclientGate();
			releaseMiniclients('no hub open');
		}
	};
};

const installNavigationGuard = (router: Router) => {
	router.beforeEach(createNavigationGuard());
};

export { createNavigationGuard, installNavigationGuard };
