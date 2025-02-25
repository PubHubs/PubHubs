import { setActivePinia, createPinia } from 'pinia';
import { describe, expect, test, afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { useGlobal, PinnedHubs } from '@/logic/store/global';
import { useSettings } from '@/logic/store/settings';
import { api } from '@/logic/core/api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

let pinia;

describe('Global', () => {
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
			const resp = await global.getHubs();
			expect(resp).toBeTypeOf('object');
			expect(resp).toHaveLength(3);

			expect(resp[0]).toBeTypeOf('object');
			expect(resp[0]).toHaveProperty('hubId');
			expect(resp[0]).toHaveProperty('url');
			expect(resp[0]).toHaveProperty('description');
			expect(resp[0]).toHaveProperty('logo');
			expect(resp[0]).toHaveProperty('unreadMessages');
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
			global.addPinnedHub({ hubId: 'TestHub2-Id', hubName: 'Testhub2', description: 'Lorem ipsum dolor sit amet.' }, 1);
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
