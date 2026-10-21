// Packages
import { server } from '../mocks/server';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { type AttrKeyResp } from '@global-client/models/MSS/TAuths';
import { type SignedIdentifyingAttrs } from '@global-client/models/MSS/TGeneral';

// Stores
import { type GlobalSettings, useGlobal } from '@global-client/stores/global';

const OBJ = 'http://testdomain/.ph/user/obj';

beforeAll(async () => {
	server.listen({ onUnhandledRequest: 'error' });
	// A logged-in user with a user secret, as in global.test.ts.
	await api.api(api.apiURLS.login);
	const phcServer = new PHCServer();
	const attrKeys: Record<string, AttrKeyResp> = { email: { latest_key: ['someKey1', 'timestamp1'], old_key: null } };
	const identifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };
	await phcServer.stateEP();
	await phcServer.storeUserSecretObject(attrKeys, identifyingAttrs, null, null);
});
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

async function encrypted(data: GlobalSettings): Promise<ArrayBuffer> {
	const key = new Uint8Array(Buffer.from(localStorage.getItem('UserSecret')!, 'base64'));
	const bytes = await new PHCServer().encryptData(new TextEncoder().encode(JSON.stringify(data)), key);
	return bytes.buffer as ArrayBuffer;
}

async function decrypted(body: ArrayBuffer): Promise<GlobalSettings> {
	const plain = await new PHCServer().decryptData(new Uint8Array(body), localStorage.getItem('UserSecret')!);
	return JSON.parse(new TextDecoder().decode(plain)) as GlobalSettings;
}

function stateWithSettingsHash(hash: string) {
	return HttpResponse.json({
		Ok: {
			State: {
				allow_login_by: ['someAttribute'],
				could_be_banned_by: ['someBannableAttribute'],
				stored_objects: {
					usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 },
					usersecretbackup: { hash: 'userSecretBackupHash', hmac: 'userSecretBackupHmac', size: 300 },
					globalsettings: { hash, hmac: `${hash}Hmac`, size: 350 },
				},
			},
		},
	});
}

function storedWithSettingsHash(hash: string) {
	return HttpResponse.json({ Ok: { Stored: { stored_objects: { globalsettings: { hash, hmac: `${hash}Hmac`, size: 350 } } } } });
}

describe('saving the global settings', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	test('stores on top of the loaded copy', async () => {
		const bodies: ArrayBuffer[] = [];
		server.use(
			http.post(`${OBJ}/by-hash/globalsettings/globalSettingsHash`, async ({ request }) => {
				bodies.push(await request.arrayBuffer());
				return storedWithSettingsHash('savedHash');
			}),
		);
		const global = useGlobal();
		expect(await global.checkLoginAndSettings()).toBe(true);
		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await global.saveGlobalSettings();

		expect(bodies).toHaveLength(1);
		expect((await decrypted(bodies[0])).hubs.map((h) => h.hubId)).toEqual(['TestHub0-Id', 'TestHub1-Id']);
	});

	test('merges with changes from another device instead of overwriting them', async () => {
		const bodies: ArrayBuffer[] = [];
		const global = useGlobal();
		expect(await global.checkLoginAndSettings()).toBe(true);

		// Meanwhile another device pinned TestHub9.
		server.use(
			http.post(`${OBJ}/by-hash/globalsettings/globalSettingsHash`, () => HttpResponse.json({ Ok: 'HashDidNotMatch' })),
			http.get('http://testdomain/.ph/user/state', () => stateWithSettingsHash('remoteHash')),
			http.get(`${OBJ}/by-hash/remoteHash/remoteHashHmac`, async () =>
				HttpResponse.arrayBuffer(
					await encrypted({
						theme: 'dark' as GlobalSettings['theme'],
						timeformat: 'format24' as GlobalSettings['timeformat'],
						language: 'nl',
						hubs: [
							{ hubId: 'TestHub0-Id', hubName: 'Testhub0' },
							{ hubId: 'TestHub9-Id', hubName: 'Testhub9' },
						],
					}),
					{ headers: { 'content-type': 'application/octet-stream' } },
				),
			),
			http.post(`${OBJ}/by-hash/globalsettings/remoteHash`, async ({ request }) => {
				bodies.push(await request.arrayBuffer());
				return storedWithSettingsHash('mergedHash');
			}),
		);

		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await global.saveGlobalSettings();

		expect(bodies).toHaveLength(1);
		const stored = await decrypted(bodies[0]);
		expect(stored.hubs.map((h) => h.hubId)).toEqual(['TestHub0-Id', 'TestHub1-Id', 'TestHub9-Id']);
		expect(stored.theme).toBe('dark');
		expect(global.pinnedHubs.map((h) => h.hubId)).toEqual(['TestHub0-Id', 'TestHub1-Id', 'TestHub9-Id']);
	});

	test('never stores after a failed load without a copy on this device', async () => {
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('ph:ls:')) localStorage.removeItem(key);
		}
		let posted = false;
		server.use(
			http.get('http://testdomain/.ph/user/state', () => HttpResponse.error()),
			http.post(`${OBJ}/by-hash/globalsettings/:hash`, () => {
				posted = true;
				return storedWithSettingsHash('x');
			}),
		);
		const global = useGlobal();
		await global.checkLoginAndSettings();
		global.loggedIn = true;
		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await global.saveGlobalSettings();
		expect(posted).toBe(false);
	});

	test('a network error while storing does not navigate to the error page', async () => {
		const global = useGlobal();
		expect(await global.checkLoginAndSettings()).toBe(true);
		server.use(http.post(`${OBJ}/by-hash/globalsettings/:hash`, () => HttpResponse.error()));

		// The store has no router in tests, so a navigation attempt would throw here.
		global.addPinnedHub({ hubId: 'TestHub1-Id', hubName: 'Testhub1' });
		await expect(global.saveGlobalSettings()).resolves.toBeUndefined();
	});
});
