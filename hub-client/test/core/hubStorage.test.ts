import { describe, expect, test } from 'vitest';

import { HubStorage, type KeyValueBackend } from '@hub-client/logic/core/hubStorage';

function memoryBackend(): KeyValueBackend & { records: Map<string, unknown> } {
	const records = new Map<string, unknown>();
	return {
		records,
		get: async (key) => records.get(key) as never,
		put: async (key, value) => {
			records.set(key, value);
		},
		delete: async (key) => {
			records.delete(key);
		},
		clear: async () => {
			records.clear();
		},
	};
}

function randomKey(): string {
	return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
}

describe('HubStorage', () => {
	test('stores values encrypted and reads them back', async () => {
		const backend = memoryBackend();
		const storage = new HubStorage();
		expect(await storage.open(randomKey(), async () => backend)).toBe(true);

		await storage.set('consent', { needsConsent: false, version: 3 });
		expect(await storage.get('consent')).toEqual({ needsConsent: false, version: 3 });

		const raw = JSON.stringify([...backend.records.values()].map((r) => new Uint8Array((r as { data: ArrayBuffer }).data)));
		expect(raw).not.toContain('needsConsent');
	});

	test('is readable again with the same key', async () => {
		const backend = memoryBackend();
		const key = randomKey();
		const first = new HubStorage();
		await first.open(key, async () => backend);
		await first.set('a', 1);

		const second = new HubStorage();
		await second.open(key, async () => backend);
		expect(await second.get('a')).toBe(1);
	});

	test('wipes data written with another key', async () => {
		const backend = memoryBackend();
		const first = new HubStorage();
		await first.open(randomKey(), async () => backend);
		await first.set('a', 1);

		const second = new HubStorage();
		expect(await second.open(randomKey(), async () => backend)).toBe(true);
		expect(await second.get('a')).toBeUndefined();
		expect(backend.records.size).toBe(1); // only the new key check
	});

	test('drops an entry it cannot read', async () => {
		const backend = memoryBackend();
		const storage = new HubStorage();
		await storage.open(randomKey(), async () => backend);
		await storage.set('a', 1);
		backend.records.set('a', { iv: new Uint8Array(12), data: new ArrayBuffer(20) });

		expect(await storage.get('a')).toBeUndefined();
		expect(backend.records.has('a')).toBe(false);
	});

	test('is unavailable, and silently a no-op, without a backend', async () => {
		const storage = new HubStorage();
		expect(
			await storage.open(randomKey(), async () => {
				throw new Error('IndexedDB is not available');
			}),
		).toBe(false);
		await storage.set('a', 1);
		expect(await storage.get('a')).toBeUndefined();
		expect(storage.available).toBe(false);
	});

	test('disable() settles it as unavailable, and later opens are ignored', async () => {
		const storage = new HubStorage();
		storage.disable();
		expect(await storage.ready).toBe(false);
		expect(await storage.open(randomKey(), async () => memoryBackend())).toBe(false);
	});
});
