// Packages
import { server } from '../mocks/server';
import * as sdk from 'matrix-js-sdk';
import type * as MatrixSdk from 'matrix-js-sdk';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { Authentication } from '@hub-client/logic/core/authentication';

// Stores
import { MessageType, useMessageBox } from '@hub-client/stores/messagebox';

const createClient = vi.hoisted(() => vi.fn());

vi.mock('matrix-js-sdk', async (importOriginal) => {
	const original = await importOriginal<typeof MatrixSdk>();
	return { ...original, createClient: (opts: { baseUrl: string }) => createClient(opts) };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('Authentication.login', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createClient.mockReset();
		createClient.mockImplementation((opts: { baseUrl: string }) => ({ baseUrl: opts.baseUrl }));
		const accessToken = JSON.stringify({ token: 'syt_token', userId: '@abc-123:testing' });
		window.history.replaceState({}, '', `/?${new URLSearchParams({ accessToken })}`);
	});

	test('creates the client with the device id Synapse reports for the access token', async () => {
		server.use(
			http.get('http://testing/_matrix/client/v3/account/whoami', ({ request }) => {
				if (request.headers.get('Authorization') !== 'Bearer syt_token') {
					return HttpResponse.json({ errcode: 'M_UNKNOWN_TOKEN' }, { status: 401 });
				}
				return HttpResponse.json({ user_id: '@abc-123:testing', device_id: 'JKUGHYUMRE' });
			}),
		);

		await new Authentication().login();

		expect(createClient).toHaveBeenCalledOnce();
		expect(createClient.mock.calls[0][0]).toMatchObject({ userId: '@abc-123:testing', deviceId: 'JKUGHYUMRE' });
	});

	test('fails the login when Synapse cannot tell which device the token belongs to', async () => {
		server.use(http.get('http://testing/_matrix/client/v3/account/whoami', () => HttpResponse.json({ errcode: 'M_UNKNOWN_TOKEN' }, { status: 401 })));

		await expect(new Authentication().login()).rejects.toThrow();
		expect(createClient).not.toHaveBeenCalled();
	});
});

/** What Synapse answers to /keys/query for our own device. */
function serverDeviceKeys(hasKeys: boolean) {
	const queried = vi.fn();
	server.use(
		http.post('http://testing/_matrix/client/v3/keys/query', async ({ request }) => {
			queried(await request.json());
			const device_keys = hasKeys ? { '@abc-123:testing': { JKUGHYUMRE: { device_id: 'JKUGHYUMRE' } } } : { '@abc-123:testing': {} };
			return HttpResponse.json({ device_keys });
		}),
	);
	return queried;
}

function acceptWhoami() {
	server.use(http.get('http://testing/_matrix/client/v3/account/whoami', () => HttpResponse.json({ user_id: '@abc-123:testing', device_id: 'JKUGHYUMRE' })));
}

/**
 * Pretend this context may use IndexedDB (jsdom has none). The sync store is stubbed with an in-memory one on purpose:
 * encryption keeps its own database, so it must not depend on whether the sync cache could start.
 */
function withUsableIndexedDB(existingDatabases: string[] = []) {
	const deleteDatabase = vi.fn();
	const open = () => {
		const request: { result?: { close: () => void }; onsuccess?: () => void } = {};
		setTimeout(() => {
			request.result = { close: () => {} };
			request.onsuccess?.();
		});
		return request;
	};
	const databases = () => Promise.resolve(existingDatabases.map((name) => ({ name, version: 1 })));
	vi.stubGlobal('indexedDB', { open, deleteDatabase, databases });
	const prototype = Authentication.prototype as unknown as { _createSyncStore: () => Promise<unknown> };
	vi.spyOn(prototype, '_createSyncStore').mockResolvedValue(new sdk.MemoryStore());
	return { deleteDatabase };
}

describe('Authentication.login crypto', () => {
	const initRustCrypto = vi.fn();

	beforeEach(() => {
		setActivePinia(createPinia());
		createClient.mockReset();
		initRustCrypto.mockReset().mockResolvedValue(undefined);
		createClient.mockImplementation((opts: { baseUrl: string; deviceId: string }) => ({
			baseUrl: opts.baseUrl,
			initRustCrypto,
			getDeviceId: () => opts.deviceId,
		}));
		const accessToken = JSON.stringify({ token: 'syt_token', userId: '@abc-123:testing' });
		window.history.replaceState({}, '', `/?${new URLSearchParams({ accessToken })}`);
		acceptWhoami();
		serverDeviceKeys(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test('starts encryption with a per-device store when asked and IndexedDB is usable, even if the sync cache is in memory', async () => {
		withUsableIndexedDB();
		const auth = new Authentication();

		await auth.login({ withCrypto: true });

		expect(initRustCrypto).toHaveBeenCalledWith({ cryptoDatabasePrefix: 'pubhubs-crypto-@abc-123:testing-JKUGHYUMRE' });
		expect(auth.e2eeAvailable).toBe(true);
	});

	test('leaves encryption off when not asked, as the unread-only miniclient does', async () => {
		withUsableIndexedDB();
		const auth = new Authentication();

		await auth.login();

		expect(initRustCrypto).not.toHaveBeenCalled();
		expect(auth.e2eeAvailable).toBe(false);
	});

	test('leaves encryption off when this context cannot use IndexedDB', async () => {
		// jsdom has no IndexedDB, as in a storage-blocked iframe.
		const auth = new Authentication();

		await auth.login({ withCrypto: true });

		expect(initRustCrypto).not.toHaveBeenCalled();
		expect(auth.e2eeAvailable).toBe(false);
	});

	test("deletes the crypto stores of this user's earlier devices, which can never be used again", async () => {
		const { deleteDatabase } = withUsableIndexedDB([
			'pubhubs-crypto-@abc-123:testing-OLDDEVICE::matrix-sdk-crypto',
			'pubhubs-crypto-@abc-123:testing-OLDDEVICE::matrix-sdk-crypto-meta',
			'pubhubs-crypto-@abc-123:testing-JKUGHYUMRE::matrix-sdk-crypto',
			'pubhubs-crypto-@someone-else:testing-THEIRS::matrix-sdk-crypto',
			'pubhubs-db-@abc-123:testing',
		]);

		await new Authentication().login({ withCrypto: true });

		const deletedCryptoStores = deleteDatabase.mock.calls.map(([name]) => name).filter((name) => name.startsWith('pubhubs-crypto-'));
		expect(deletedCryptoStores.sort()).toEqual([
			'pubhubs-crypto-@abc-123:testing-OLDDEVICE::matrix-sdk-crypto',
			'pubhubs-crypto-@abc-123:testing-OLDDEVICE::matrix-sdk-crypto-meta',
		]);
	});

	test('asks the global client for a new device when this device lost its crypto store but Synapse still has its keys', async () => {
		withUsableIndexedDB([]);
		serverDeviceKeys(true);
		const sendMessage = vi.spyOn(useMessageBox(), 'sendMessage').mockImplementation(() => {});
		const auth = new Authentication();

		await auth.login({ withCrypto: true });

		expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: MessageType.RemoveAccessToken }));
		expect(initRustCrypto).not.toHaveBeenCalled();
		expect(auth.e2eeAvailable).toBe(false);
	});

	test('does not ask Synapse about the device when its crypto store is still there', async () => {
		withUsableIndexedDB(['pubhubs-crypto-@abc-123:testing-JKUGHYUMRE::matrix-sdk-crypto']);
		const queried = serverDeviceKeys(true);

		await new Authentication().login({ withCrypto: true });

		expect(queried).not.toHaveBeenCalled();
		expect(initRustCrypto).toHaveBeenCalled();
	});

	test('still logs in when encryption fails to start', async () => {
		withUsableIndexedDB();
		initRustCrypto.mockRejectedValue(new Error('wasm failed'));
		const auth = new Authentication();

		await expect(auth.login({ withCrypto: true })).resolves.toMatchObject({ baseUrl: 'http://testing' });
		expect(auth.e2eeAvailable).toBe(false);
	});
});
