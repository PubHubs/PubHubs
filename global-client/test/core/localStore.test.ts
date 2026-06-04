import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore } from '@global-client/logic/utils/localStore';

// Deterministic 32-byte secret: bytes 0x00..0x1f
const SECRET = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)));
// Different secret for isolation tests: all 0xbb
const SECRET_OTHER = btoa(String.fromCharCode(...new Uint8Array(32).fill(0xbb)));

// Realistic hub IDs (base64url-encoded 32-byte hashes, as returned by PHC welcome endpoint)
const HUB_A = 'bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA';
const HUB_B = 'xQ7v3mR1kN5pYzWfGhT2jL8cAeUoSdIgKwFqXnBbCvE';

const warnings: string[] = [];
const warn = (msg: string) => warnings.push(msg);

beforeEach(() => {
	// jsdom in this environment lacks localStorage.clear(), so remove keys manually.
	for (const key of Object.keys(localStorage)) {
		localStorage.removeItem(key);
	}
	warnings.length = 0;
});

describe('LocalStore', () => {
	it('round-trips a value through set and get', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('mykey', 'hello world');
		expect(await store.get('mykey')).toBe('hello world');
	});

	it('returns null for a missing key', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		expect(await store.get('nonexistent')).toBeNull();
	});

	it('overwrites an existing key', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('k', 'first');
		await store.set('k', 'second');
		expect(await store.get('k')).toBe('second');
	});

	it('getAll returns all stored pairs', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('a', '1');
		await store.set('b', '2');
		await store.set('c', '3');
		expect(await store.getAll()).toEqual({ a: '1', b: '2', c: '3' });
	});

	it('getAll returns empty object when nothing stored', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		expect(await store.getAll()).toEqual({});
	});

	it('isolates data between different users', async () => {
		const storeA = await LocalStore.create(SECRET, HUB_A, warn);
		const storeB = await LocalStore.create(SECRET_OTHER, HUB_A, warn);
		await storeA.set('key', 'user A data');
		await storeB.set('key', 'user B data');
		expect(await storeA.get('key')).toBe('user A data');
		expect(await storeB.get('key')).toBe('user B data');
	});

	it('isolates data between different hubs', async () => {
		const store1 = await LocalStore.create(SECRET, HUB_A, warn);
		const store2 = await LocalStore.create(SECRET, HUB_B, warn);
		await store1.set('key', 'hub A data');
		await store2.set('key', 'hub B data');
		expect(await store1.get('key')).toBe('hub A data');
		expect(await store2.get('key')).toBe('hub B data');
	});

	it('cannot read data with a different user secret', async () => {
		const storeA = await LocalStore.create(SECRET, HUB_A, warn);
		await storeA.set('key', 'secret data');
		const storeB = await LocalStore.create(SECRET_OTHER, HUB_A, warn);
		expect(await storeB.get('key')).toBeNull();
	});

	it('removes and warns on corrupted entries', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('good', 'value');

		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)!;
			if (k.endsWith(':good')) {
				localStorage.setItem(k, 'not-valid-encrypted-data');
			}
		}

		expect(await store.get('good')).toBeNull();
		expect(warnings.length).toBe(1);
		expect(warnings[0]).toContain('Removing unreadable');
	});

	it('getAll skips and removes corrupted entries', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('ok', 'fine');
		await store.set('bad', 'will be corrupted');

		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)!;
			if (k.endsWith(':bad')) {
				localStorage.setItem(k, 'corrupted');
			}
		}

		const all = await store.getAll();
		expect(all).toEqual({ ok: 'fine' });
		expect(warnings.length).toBe(1);
	});

	it('rejects a user secret of wrong length', async () => {
		const shortSecret = btoa(String.fromCharCode(...new Uint8Array(16).fill(0xcc)));
		await expect(LocalStore.create(shortSecret, HUB_A, warn)).rejects.toThrow('must be 32 bytes');
	});

	it('handles empty string values', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		await store.set('empty', '');
		expect(await store.get('empty')).toBe('');
	});

	// Pinned test vectors: any change to key derivation or encryption breaks this test.
	// Computed from SECRET (bytes 0x00..0x1f), HUB_A, key 'testkey', value 'hello',
	// with a zero IV (12 zero bytes).
	it('produces pinned localStorage key and ciphertext', async () => {
		const store = await LocalStore.create(SECRET, HUB_A, warn);
		const zeroIv = new Uint8Array(12);
		await store.set('testkey', 'hello', zeroIv);

		const expectedKey = 'ph:ls:f3a186c6699ae3d5:ed056996f97de45f:testkey';
		const expectedValue = 'AAAAAAAAAAAAAAAAKyeeOd+q/DB+WRF/C8azV/HBBu71';

		expect(localStorage.getItem(expectedKey)).toBe(expectedValue);
		expect(await store.get('testkey')).toBe('hello');
	});
});
