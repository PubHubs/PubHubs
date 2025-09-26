import { PinnedHubs, useGlobal } from '@/logic/store/global';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { server } from '../mocks/server';
import { api } from '@/logic/core/api';
import { useSettings } from '@/logic/store/settings';
import { useHubs } from '@/logic/store/hubs';
import PHCServer from '@/model/MSS/PHC';
import * as mssTypes from '@/model/MSS/TMultiServerSetup';

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
			expect(settings.language).toEqual('en');
			expect(global.pinnedHubs).toHaveLength(0);
		});
		test('logged in', async () => {
			const global = useGlobal();
			const settings = useSettings(pinia);

			await api.api(api.apiURLS.login);
			phcServer = new PHCServer();
			const mockedAttrKeysResp: Record<string, mssTypes.AttrKeyResp> = {
				email: {
					latest_key: ['someKey1', 'timestamp1'],
					old_key: null,
				},
			};
			const mockedIdentifyingAttrs: mssTypes.SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

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
