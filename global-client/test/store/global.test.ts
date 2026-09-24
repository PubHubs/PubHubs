// Packages
// Tests
import { server } from '../mocks/server';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { AttrKeyResp } from '@global-client/models/MSS/TAuths';
import { SignedIdentifyingAttrs } from '@global-client/models/MSS/TGeneral';

// Stores
import { GlobalSettings, PinnedHubs, useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

import { Theme, TimeFormat, useSettings } from '@hub-client/stores/settings';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

let pinia;

describe('Global', () => {
	let phcServer: PHCServer;
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	describe('core', () => {
		test('default', () => {
			const global = useGlobal();
			expect(global).toBeTypeOf('object');
			expect(global).toHaveProperty('loggedIn');
			expect(global.loggedIn).toEqual(false);
			expect(global).toHaveProperty('pinnedHubs');
			expect(global.pinnedHubs).toEqual([] as PinnedHubs);
		});
	});

	describe('login And Settings', () => {
		test('not logged in', async () => {
			const global = useGlobal();
			const resp = await global.checkLoginAndSettings();
			expect(resp).toEqual(false);

			const settings = useSettings(pinia);

			expect(settings.theme).toEqual('system');
			expect(settings.language).toEqual('nl');
			expect(global.pinnedHubs).toHaveLength(0);
		});
		test('logged in', async () => {
			const global = useGlobal();
			const settings = useSettings(pinia);

			await api.api(api.apiURLS.login);
			phcServer = new PHCServer();
			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey1', 'timestamp1'],
					old_key: null,
				},
			};
			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			// Simulating the call to stateEP which would normally be performed when requesting the usersecret object to check if it already exists (in the login function), to initialize the "shadow record" of the user state.
			await phcServer.stateEP();
			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, null, null);
			const resp = await global.checkLoginAndSettings();
			expect(resp).toEqual(true);

			expect(settings.theme).toBeTypeOf('string');
			expect(settings.language).toBeTypeOf('string');
			expect(settings.language).toHaveLength(2);
			expect(global.pinnedHubs).toHaveLength(1);
		});
	});

	describe('login check', () => {
		test('concurrent checks share one run', async () => {
			const global = useGlobal();
			const spy = vi.spyOn(global, 'loadLoginAndSettings');

			const [first, second] = await Promise.all([global.checkLoginAndSettings(), global.checkLoginAndSettings()]);

			expect(spy).toHaveBeenCalledTimes(1);
			expect(first).toEqual(second);

			// The shared promise is dropped once it settles, so a later navigation re-checks.
			expect(global.loginCheck).toBeNull();
			await global.checkLoginAndSettings();
			expect(spy).toHaveBeenCalledTimes(2);
		});
	});

	describe('global settings', () => {
		test('settings stored by an older client', async () => {
			const global = useGlobal();
			const settings = useSettings(pinia);

			// The shape written before `hubs` and `lastHubId` existed. A missing `hubs` used to throw,
			// which the caller turned into a cleared auth token and a silent logout.
			const legacySettings = { theme: Theme.Dark, timeformat: TimeFormat.format12, language: 'en' } as GlobalSettings;
			await global.setGlobalSettings(legacySettings);

			expect(global.pinnedHubs).toEqual([]);
			expect(settings.getLastVisitedHub).toEqual('');
			expect(settings.theme).toEqual('dark');
			expect(settings.getTimeFormat).toEqual('format12');
		});

		test('pinning a hub does not mutate the defaults', async () => {
			const global = useGlobal();
			await global.setGlobalSettings({ theme: Theme.System, timeformat: TimeFormat.format24, language: 'en' } as GlobalSettings);
			global.addPinnedHub({ hubId: 'testhub0id', hubName: 'TestHub0' });

			// Reloading the same defaults must not carry the hub pinned above along with it.
			await global.setGlobalSettings({ theme: Theme.System, timeformat: TimeFormat.format24, language: 'en' } as GlobalSettings);
			expect(global.pinnedHubs).toEqual([]);
		});

		test('the last visited hub is restored from the stored settings', async () => {
			const global = useGlobal();
			const settings = useSettings(pinia);

			await global.setGlobalSettings({ theme: Theme.System, timeformat: TimeFormat.format24, language: 'en', hubs: [], lastHubId: 'testhub1id' });

			expect(settings.getLastVisitedHub).toEqual('testhub1id');
		});

		test('the last visited hub is part of the settings that get stored', () => {
			const global = useGlobal();
			useSettings(pinia).setLastVisitedHub('testhub2id');

			expect(global.getGlobalSettings.lastHubId).toEqual('testhub2id');
		});
	});

	describe('login and hubs', () => {
		test('fetch hubs', async () => {
			const global = useGlobal();
			await global.getAllHubs();
			const hubs = useHubs();
			expect(hubs.hasHubs).toEqual(true);
			expect(hubs.hubsArray).toHaveLength(3);

			const testhub0 = hubs.hub('testhub0id');
			expect(testhub0).toBeTypeOf('object');
			expect(testhub0).toHaveProperty('hubId');
			expect(testhub0).toHaveProperty('url');
			expect(testhub0).toHaveProperty('description');
			expect(testhub0).toHaveProperty('logo');
		});
		test('fetch pinned hubs only', async () => {
			const global = useGlobal();
			global.pinnedHubs = [
				{ hubId: 'testhub0id', hubName: 'TestHub0' },
				// PHC advertises this one without a trailing slash, so it covers both url shapes.
				{ hubId: 'testhub2id', hubName: 'TestHub2' },
			] as PinnedHubs;

			await global.getPinnedHubsData();

			const hubs = useHubs();
			expect(hubs.hubsArray).toHaveLength(2);
			expect(hubs.hub('testhub1id')).toBeUndefined();

			// The `_synapse/client` prefix belongs to the endpoints in `hub_api.apiURLS`, so it must
			// be stripped exactly once here. Getting this wrong requests
			// `_synapse/client/_synapse/client/.ph/info`, which msw rejects as unhandled and leaves
			// the hub out of the store altogether.
			expect(hubs.serverUrl('testhub0id')).toEqual('http://hubtest0/');
			expect(hubs.serverUrl('testhub2id')).toEqual('http://hubtest2/');
		});
		test('fetch a single hub by name', async () => {
			const global = useGlobal();

			await global.getHubData('TestHub1');

			const hubs = useHubs();
			expect(hubs.hubsArray).toHaveLength(1);
			expect(hubs.hub('testhub1id')).toBeTypeOf('object');
		});
		test('fetching a hub that does not exist loads nothing', async () => {
			const global = useGlobal();

			await global.getHubData('NoSuchHub');

			expect(useHubs().hubsArray).toHaveLength(0);
			expect(global.hubsLoading).toEqual(false);
		});
		// The first navigation waits for the pinned-hub load, so a hub server that accepts the
		// connection and then never answers must not keep the whole app from rendering.
		test('a pinned hub that never answers gives up without holding the other hubs back', async () => {
			const global = useGlobal();
			global.pinnedHubs = [
				{ hubId: 'testhub0id', hubName: 'TestHub0' },
				{ hubId: 'testhub1id', hubName: 'TestHub1' },
			] as PinnedHubs;

			// The real timeout is 5 seconds of wall clock, which fake timers do not reach, so the test
			// hands out signals it can fire itself.
			const timeouts: AbortController[] = [];
			const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
				const controller = new AbortController();
				timeouts.push(controller);
				return controller.signal;
			});
			onTestFinished(() => timeoutSpy.mockRestore());
			server.use(http.get('http://hubtest1/_synapse/client/.ph/info', () => new Promise<never>(() => {})));

			let settled = false;
			const load = global.getPinnedHubsData().finally(() => (settled = true));

			const hubs = useHubs();
			await vi.waitFor(() => expect(hubs.hub('testhub0id')).toBeTypeOf('object'));
			expect(settled).toEqual(false);
			expect(timeoutSpy).toHaveBeenCalledWith(5000);

			timeouts.forEach((controller) => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')));
			await load;

			expect(hubs.hub('testhub1id')).toBeUndefined();
			expect(global.hubsLoading).toEqual(false);
		});
		test('changed pinnedHubs', async () => {
			const global = useGlobal();
			await api.api(api.apiURLS.login);
			const resp = await global.checkLoginAndSettings();

			expect(resp).toEqual(true);
			expect(global.pinnedHubs).toBeTypeOf('object');
			expect(global.pinnedHubs).toEqual([{ hubId: 'TestHub0-Id', hubName: 'Testhub0' }]);

			global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
			expect(global.pinnedHubs).toEqual([
				{ hubId: 'TestHub0-Id', hubName: 'Testhub0' },
				{ hubId: 'TestHub1-Id', hubName: 'Testhub1' },
			]);
			global.addPinnedHub({ hubId: 'TestHub2-Id', hubName: 'Testhub2' }, 1);
			expect(global.pinnedHubs).toEqual([
				{ hubId: 'TestHub0-Id', hubName: 'Testhub0' },
				{ hubId: 'TestHub2-Id', hubName: 'Testhub2' },
				{ hubId: 'TestHub1-Id', hubName: 'Testhub1' },
			]);
			global.removePinnedHub(1);
			expect(global.pinnedHubs).toEqual([
				{ hubId: 'TestHub0-Id', hubName: 'Testhub0' },
				{ hubId: 'TestHub1-Id', hubName: 'Testhub1' },
			]);
			global.removePinnedHub(0);
			expect(global.pinnedHubs).toEqual([{ hubId: 'TestHub1-Id', hubName: 'Testhub1' }]);
		});

		// App.vue starts the pinned hub load on mount and the navigation guard asks for it on the
		// first navigation, so on every page load there are two callers racing each other.
		test('a second caller joins the load in flight instead of starting one', async () => {
			const global = useGlobal();
			global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }] as PinnedHubs;

			let hubInfoRequests = 0;
			server.use(
				http.get('http://hubtest0/_synapse/client/.ph/info', () => {
					hubInfoRequests++;
					return HttpResponse.json({ Ok: { hub_client_url: 'http://hubtest0-client/', hub_version: 'versionHub0' } }, { status: 200 });
				}),
			);

			await Promise.all([global.getPinnedHubsData(), global.getPinnedHubsData()]);

			expect(hubInfoRequests).toEqual(1);
			expect(useHubs().hubsArray).toHaveLength(1);
		});

		test('a failed load is not left behind as the answer for the rest of the session', async () => {
			const global = useGlobal();
			global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }] as PinnedHubs;

			server.use(http.get('http://testdomain/.ph/user/welcome', () => HttpResponse.error()));
			await expect(global.getPinnedHubsData()).rejects.toThrow();
			expect(global.hubsLoading).toEqual(false);

			// PHC is back, so asking again has to retry rather than report the failed load as done.
			server.resetHandlers();
			await global.getPinnedHubsData();
			expect(useHubs().hub('testhub0id')).toBeTypeOf('object');
		});

		test('the loading flag stays set until the last of two overlapping loads finishes', async () => {
			const global = useGlobal();
			global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }] as PinnedHubs;

			let releaseHub1 = () => {};
			const hub1Answers = new Promise<void>((resolve) => (releaseHub1 = resolve));
			server.use(
				http.get('http://hubtest1/_synapse/client/.ph/info', async () => {
					await hub1Answers;
					return HttpResponse.json({ Ok: { hub_client_url: 'http://hubtest1-client/', hub_version: 'versionHub1' } }, { status: 200 });
				}),
			);

			// The discover page loads every hub while the pinned hubs are still on their way.
			const pinnedLoad = global.getPinnedHubsData();
			const discoverLoad = global.getAllHubs();

			await pinnedLoad;
			expect(global.hubsLoading).toEqual(true);

			releaseHub1();
			await discoverLoad;
			expect(global.hubsLoading).toEqual(false);
		});
	});
});
