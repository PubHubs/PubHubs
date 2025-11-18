// Packages
// Tests
import { server } from '../mocks/server';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { AttrKeyResp, SignedIdentifyingAttrs } from '@global-client/models/MSS/TAuths';

// Stores
import { PinnedHubs, useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

import { useSettings } from '@hub-client/stores/settings';

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
			await phcServer['_stateEP']();
			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, null, null);
			const resp = await global.checkLoginAndSettings();
			expect(resp).toEqual(true);

			expect(settings.theme).toBeTypeOf('string');
			expect(settings.language).toBeTypeOf('string');
			expect(settings.language).toHaveLength(2);
			expect(global.pinnedHubs).toHaveLength(1);
		});
	});

	describe('login and hubs', () => {
		test('fetch hubs', async () => {
			const global = useGlobal();
			await global.getHubs();
			const hubs = useHubs();
			expect(hubs.hasHubs).toEqual(true);
			expect(hubs.hubsArray).toHaveLength(3);

			const testhub0 = hubs.hub('testhub0id');
			expect(testhub0).toBeTypeOf('object');
			expect(testhub0).toHaveProperty('hubId');
			expect(testhub0).toHaveProperty('url');
			expect(testhub0).toHaveProperty('description');
			expect(testhub0).toHaveProperty('logo');
			expect(testhub0).toHaveProperty('unreadMessages');
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
	});
});
