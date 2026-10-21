// Packages
import { server } from '../mocks/server';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { watch } from 'vue';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { type AttrKeyResp } from '@global-client/models/MSS/TAuths';
import { type SignedIdentifyingAttrs } from '@global-client/models/MSS/TGeneral';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';
import { useMSS } from '@global-client/stores/mss';

// A restart of the app: fresh in-memory stores, the same localStorage.
function restart() {
	setActivePinia(createPinia());
	return useGlobal();
}

function phcUnreachable() {
	server.use(
		http.get('http://testdomain/.ph/user/state', () => HttpResponse.error()),
		http.get('http://testdomain/.ph/user/welcome', () => HttpResponse.error()),
		http.post('http://testdomain/.ph/user/obj/by-hash/globalsettings/:hash', () => HttpResponse.error()),
	);
}

// PHC accepts every store. Logging in stores the settings when they changed on the way in.
function phcStores() {
	server.use(
		http.post('http://testdomain/.ph/user/obj/by-hash/globalsettings/:hash', () =>
			HttpResponse.json({ Ok: { Stored: { stored_objects: { globalsettings: { hash: 'savedHash', hmac: 'savedHashHmac', size: 350 } } } } }),
		),
	);
}

function clearDeviceCopies() {
	for (const key of Object.keys(localStorage)) {
		if (key.startsWith('ph:ls:') || key === 'ph:hubs-cache') localStorage.removeItem(key);
	}
}

beforeAll(async () => {
	server.listen({ onUnhandledRequest: 'error' });
	await api.api(api.apiURLS.login);
	const phcServer = new PHCServer();
	const attrKeys: Record<string, AttrKeyResp> = { email: { latest_key: ['someKey1', 'timestamp1'], old_key: null } };
	const identifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };
	await phcServer.stateEP();
	await phcServer.storeUserSecretObject(attrKeys, identifyingAttrs, null, null);
});
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('the app shell without PHC', () => {
	beforeEach(() => {
		clearDeviceCopies();
	});

	test('stays logged in with the settings cached on this device', async () => {
		server.use(
			http.post('http://testdomain/.ph/user/obj/by-hash/globalsettings/globalSettingsHash', () =>
				HttpResponse.json({ Ok: { Stored: { stored_objects: { globalsettings: { hash: 'savedHash', hmac: 'savedHashHmac', size: 350 } } } } }),
			),
		);
		let global = restart();
		expect(await global.checkLoginAndSettings()).toBe(true);
		global.addAccessTokenAndUserID('TestHub0-Id', 'hub0-token', '@user:hub0');
		await global.saveGlobalSettings();

		phcUnreachable();
		global = restart();
		expect(await global.checkLoginAndSettings()).toBe(true);
		expect(global.loggedIn).toBe(true);
		expect(global.getAuthInfo('TestHub0-Id')).toEqual({ token: 'hub0-token', userId: '@user:hub0' });
		expect(localStorage.getItem('PHauthToken')).not.toBeNull();
		expect(localStorage.getItem('UserSecret')).not.toBeNull();
	});

	test('stays logged in without a cached copy, and does not store the defaults it shows', async () => {
		phcUnreachable();
		let posted = false;
		server.use(
			http.post('http://testdomain/.ph/user/obj/by-hash/globalsettings/:hash', () => {
				posted = true;
				return HttpResponse.error();
			}),
		);
		const global = restart();
		expect(await global.checkLoginAndSettings()).toBe(true);
		expect(global.pinnedHubs).toEqual([]);
		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await global.saveGlobalSettings();
		expect(posted).toBe(false);
		expect(localStorage.getItem('UserSecret')).not.toBeNull();
	});

	test('keeps changes made offline and merges them in once PHC is back', async () => {
		let global = restart();
		expect(await global.checkLoginAndSettings()).toBe(true);

		phcUnreachable();
		global = restart();
		await global.checkLoginAndSettings();
		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await global.saveGlobalSettings();

		server.resetHandlers();
		global = restart();
		expect(await global.checkLoginAndSettings()).toBe(true);
		expect(global.pinnedHubs.map((h) => h.hubId)).toEqual(['TestHub0-Id', 'TestHub1-Id']);
	});

	// Code that reads loggedIn (the navigation guard, the hub page) relies on the settings, with the
	// pinned hubs and their tokens, being in by then.
	test('is only logged in once the settings are in, also from the copy on this device', async () => {
		const loginWatchingPinnedHubs = async () => {
			const global = restart();
			let pinnedWhenLoggedIn: number | undefined;
			const stop = watch(
				() => global.loggedIn,
				(loggedIn) => {
					if (loggedIn) pinnedWhenLoggedIn = global.pinnedHubs.length;
				},
				{ flush: 'sync' },
			);
			expect(await global.checkLoginAndSettings()).toBe(true);
			stop();
			expect(global.pinnedHubs.length).toBeGreaterThan(0);
			expect(pinnedWhenLoggedIn).toBe(global.pinnedHubs.length);
		};

		phcStores();
		await loginWatchingPinnedHubs();
		phcUnreachable();
		await loginWatchingPinnedHubs();
	});

	test('stores the settings merged with changes made offline once they are in', async () => {
		phcStores();
		let global = restart();
		await global.checkLoginAndSettings();

		phcUnreachable();
		global = restart();
		await global.checkLoginAndSettings();
		global.addPinnedHub({ hubId: 'TestHub2-Id', hubName: 'Testhub2' });
		await global.saveGlobalSettings();

		server.resetHandlers();
		global = restart();
		const store = vi.spyOn(useMSS(), 'storeUserObjectIfUnchanged').mockResolvedValue({ result: 'stored', hash: 'mergedHash' });
		await global.checkLoginAndSettings();
		await vi.waitFor(() => expect(store).toHaveBeenCalled());
		const storedHubIds = (store.mock.calls[0][1] as { hubs: { hubId: string }[] }).hubs.map((h) => h.hubId);
		expect(storedHubIds).toContain('TestHub2-Id');
		expect(storedHubIds).toEqual(global.pinnedHubs.map((h) => h.hubId));
	});

	test('still logs out when PHC refuses rather than being unreachable', async () => {
		const secret = localStorage.getItem('UserSecret')!;
		const token = localStorage.getItem('PHauthToken')!;
		server.use(http.get('http://testdomain/.ph/user/state', () => HttpResponse.json({ Err: 'InternalError' })));
		const global = restart();
		expect(await global.checkLoginAndSettings()).toBe(false);
		expect(localStorage.getItem('PHauthToken')).toBeNull();
		localStorage.setItem('UserSecret', secret);
		localStorage.setItem('PHauthToken', token);
	});
});

describe('the hub list without PHC', () => {
	beforeEach(() => {
		clearDeviceCopies();
	});

	test('shows the hubs cached on this device', async () => {
		let global = restart();
		await global.getAllHubs();
		expect(useHubs().hubsArray).toHaveLength(3);

		phcUnreachable();
		global = restart();
		expect(useHubs().hubsArray).toHaveLength(3);
		await expect(global.getAllHubs()).resolves.toBeUndefined();
		expect(useHubs().hub('testhub0id')?.serverUrl).toBe('http://hubtest0/');
		expect(global.hubsLoading).toBe(false);
	});

	// The pinned-hub load is kept for the session, so one that could only show the cached copy must
	// not be kept, or the hubs would never be refreshed once PHC is back.
	test('loads the pinned hubs again once PHC is back', async () => {
		let global = restart();
		await global.getAllHubs();

		phcUnreachable();
		global = restart();
		global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }];
		await global.getPinnedHubsData();

		server.resetHandlers();
		const fetchHubs = vi.spyOn(global, 'fetchHubs');
		await global.getPinnedHubsData();
		expect(fetchHubs).toHaveBeenCalledOnce();
	});

	test('reports the network error when nothing is cached', async () => {
		phcUnreachable();
		const global = restart();
		await expect(global.getAllHubs()).rejects.toBeDefined();
		expect(global.hubsLoading).toBe(false);
	});

	test('forgets hubs PHC no longer lists, also on this device', async () => {
		const global = restart();
		await global.getAllHubs();
		useHubs().retainHubs(['testhub0id']);
		restart();
		expect(useHubs().hubsArray.map((h) => h.hubId)).toEqual(['testhub0id']);
	});
});
