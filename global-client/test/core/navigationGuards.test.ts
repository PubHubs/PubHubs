// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

// Logic
import { createNavigationGuard } from '@global-client/logic/core/navigationGuards';
import { routes } from '@global-client/logic/core/routes';

// Stores
import { useGlobal } from '@global-client/stores/global';

import { useSettings } from '@hub-client/stores/settings';

// The gate keeps module-level state that would leak between tests, and the guard's job here is only
// to call it at the right moment -- so it is stubbed rather than exercised.
const { releaseMiniclients } = vi.hoisted(() => ({ releaseMiniclients: vi.fn() }));
vi.mock('@global-client/composables/miniclientGate.composable', () => ({
	useMiniclientGate: () => ({ releaseMiniclients }),
	useMiniclientStartSlot: vi.fn(),
}));

// Builds the `to`/`from` the router would hand the guard, taking `meta` from the real route table so
// the guard is checked against the app's actual route flags rather than a copy that can drift.
function location(name: string, fullPath?: string): RouteLocationNormalized {
	const route = routes.find((candidate) => candidate.name === name);
	if (!route) throw new Error(`no route named ${name}`);
	return { name, meta: route.meta ?? {}, fullPath: fullPath ?? route.path } as unknown as RouteLocationNormalized;
}

// A page load starts with no previous route, which is how the guard tells a fresh load from a
// navigation made inside the app.
const NO_PREVIOUS_ROUTE = { name: undefined } as unknown as RouteLocationNormalized;

describe('navigation guard', () => {
	let pinia;

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		releaseMiniclients.mockClear();
	});

	function loginAs(loggedIn: boolean) {
		const global = useGlobal();
		vi.spyOn(global, 'checkLoginAndSettings').mockResolvedValue(loggedIn);
		// For a logged-in user the guard loads the pinned hubs' data, which talks to PHC and to the
		// hubs themselves. Nothing here depends on the result, so it is stubbed rather than served.
		vi.spyOn(global, 'getPinnedHubsData').mockResolvedValue();
		return global;
	}

	function pinHubAsLastVisited() {
		const global = loginAs(true);
		global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }];
		useSettings(pinia).setLastVisitedHub('testhub0id');
		return global;
	}

	describe('error page', () => {
		test('a page load straight into the error page is sent to my hubs', async () => {
			loginAs(true);
			const guard = createNavigationGuard();

			expect(await guard(location('error'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'hubs-overview' });
		});

		test('the error page is left alone when reached from inside the app', async () => {
			loginAs(true);
			const guard = createNavigationGuard();

			expect(await guard(location('error'), location('hubs-overview'))).toBeUndefined();
		});

		// Regression: the bounce used to run after the restore below, which consumed the
		// once-per-page-load flag without restoring anything -- costing the user their last hub.
		test('the bounce does not consume the last visited hub restore', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			expect(await guard(location('error'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'hubs-overview' });
			expect(await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'hub', params: { name: 'TestHub0' } });
		});
	});

	describe('last visited hub', () => {
		test('is restored on the first navigation to my hubs', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			expect(await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'hub', params: { name: 'TestHub0' } });
		});

		test('is restored at most once per page load', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE);

			// The user has since navigated away from the hub; a deliberate click to My Hubs must stay
			// there rather than being bounced back into the hub.
			expect(await guard(location('hubs-overview'), location('hub'))).toBeUndefined();
		});

		test('is not restored when the page load went straight into a hub', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			await guard(location('hub'), NO_PREVIOUS_ROUTE);

			expect(await guard(location('hubs-overview'), location('hub'))).toBeUndefined();
		});

		test('is skipped when the last visited hub is no longer pinned', async () => {
			const global = pinHubAsLastVisited();
			global.pinnedHubs = [{ hubId: 'someOtherHubId', hubName: 'TestHub1' }];
			const guard = createNavigationGuard();

			expect(await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE)).toBeUndefined();
		});

		test('is not restored for a logged out user', async () => {
			loginAs(false);
			const guard = createNavigationGuard();

			expect(await guard(location('login'), NO_PREVIOUS_ROUTE)).toBeUndefined();
		});
	});

	describe('pinned hubs', () => {
		test('are loaded before a navigation is allowed through', async () => {
			const global = loginAs(true);
			const guard = createNavigationGuard();

			await guard(location('hub'), NO_PREVIOUS_ROUTE);

			// The hub route looks its hub up by name in the hubs store, so it cannot be reached before
			// the data is in.
			expect(global.getPinnedHubsData).toHaveBeenCalled();
		});

		// Rejecting here would reject the guard, and vue-router answers that by aborting the
		// navigation -- leaving the user on a blank page. App.vue reports the failure instead.
		test('a failed load lets the navigation through rather than aborting it', async () => {
			const global = loginAs(true);
			vi.mocked(global.getPinnedHubsData).mockRejectedValue(new Error('PHC is down'));
			const guard = createNavigationGuard();

			expect(await guard(location('hubs-overview'), location('hub'))).toBeUndefined();
		});
	});

	describe('authentication', () => {
		test('a logged out user is sent to the login page', async () => {
			loginAs(false);
			const guard = createNavigationGuard();

			expect(await guard(location('hub', '/hub/TestHub0'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'login', query: { redirect: '/hub/TestHub0' } });
		});

		test('the root path is not carried along as a redirect', async () => {
			loginAs(false);
			const guard = createNavigationGuard();

			expect(await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE)).toEqual({ name: 'login', query: {} });
		});

		test('routes that do not require auth are reachable while logged out', async () => {
			loginAs(false);
			const guard = createNavigationGuard();

			expect(await guard(location('onboarding'), NO_PREVIOUS_ROUTE)).toBeUndefined();
		});
	});

	describe('miniclient gate', () => {
		test('is opened by landing on the hub overview', async () => {
			loginAs(true);
			const guard = createNavigationGuard();

			await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE);

			expect(releaseMiniclients).toHaveBeenCalledWith('no hub open');
		});

		test('is left closed while a hub is being opened', async () => {
			loginAs(true);
			const guard = createNavigationGuard();

			await guard(location('hub'), NO_PREVIOUS_ROUTE);

			expect(releaseMiniclients).not.toHaveBeenCalled();
		});

		// The user never reaches the overview in this case: they are sent straight on into their last
		// hub, which is exactly the navigation the miniclients must keep out of the way of.
		test('is left closed when the overview redirects into the last visited hub', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE);

			expect(releaseMiniclients).not.toHaveBeenCalled();
		});

		test('is left closed when the overview redirects to the login page', async () => {
			loginAs(false);
			const guard = createNavigationGuard();

			await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE);

			expect(releaseMiniclients).not.toHaveBeenCalled();
		});

		test('is opened on a later navigation to the overview', async () => {
			pinHubAsLastVisited();
			const guard = createNavigationGuard();

			// First navigation is consumed by the last-visited-hub restore.
			await guard(location('hubs-overview'), NO_PREVIOUS_ROUTE);
			await guard(location('hubs-overview'), location('hub'));

			expect(releaseMiniclients).toHaveBeenCalledWith('no hub open');
		});
	});
});
