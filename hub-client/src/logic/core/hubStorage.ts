/**
 * HubStorage: encrypted key-value storage in the hub's own IndexedDB, for the native app, where every
 * hub runs on its own origin (see docs/app/hub-isolation.md and docs/app/offline.md).
 *
 * The key is derived by the app shell from the user secret and the hub id, and handed to the hub in
 * the messagebox handshake. Logging out deletes the user secret, which makes everything stored here
 * unreadable without the shell having to reach this origin. Opening the storage with a different key
 * (another user, a new secret) wipes what was there.
 *
 * On the web no key is sent, and HubStorage stays unavailable: callers keep their data in memory. It
 * never stores anything unencrypted.
 */
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('HubStorage');

const DB_NAME = 'pubhubs-hub-storage';
const STORE_NAME = 'kv';
const OPEN_TIMEOUT_MS = 2_000;
const KEY_CHECK = '__key_check__';
const KEY_CHECK_VALUE = 'pubhubs-hub-storage-v1';

type EncryptedRecord = { iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer };

/** Where HubStorage keeps its (already encrypted) records. */
interface KeyValueBackend {
	get(key: string): Promise<EncryptedRecord | undefined>;
	put(key: string, value: EncryptedRecord): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function openIndexedDBBackend(): Promise<KeyValueBackend> {
	if (!globalThis.indexedDB) throw new Error('IndexedDB is not available');
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		// open() can hang silently where storage is blocked.
		const timer = setTimeout(() => reject(new Error('Opening IndexedDB timed out')), OPEN_TIMEOUT_MS);
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
		request.onsuccess = () => {
			clearTimeout(timer);
			resolve(request.result);
		};
		request.onerror = () => {
			clearTimeout(timer);
			reject(request.error);
		};
	});
	const store = (mode: IDBTransactionMode) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
	return {
		get: (key) => requestToPromise(store('readonly').get(key)),
		put: async (key, value) => {
			await requestToPromise(store('readwrite').put(value, key));
		},
		delete: async (key) => {
			await requestToPromise(store('readwrite').delete(key));
		},
		clear: async () => {
			await requestToPromise(store('readwrite').clear());
		},
	};
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

class HubStorage {
	private backend: KeyValueBackend | null = null;
	private key: CryptoKey | null = null;
	private settled = false;
	private settle!: (available: boolean) => void;

	/** Resolves once it is known whether storage is available: after {@link open} or {@link disable}. */
	readonly ready: Promise<boolean> = new Promise((resolve) => {
		this.settle = resolve;
	});

	get available(): boolean {
		return this.backend !== null;
	}

	/**
	 * Open the storage with the key from the handshake (base64). Only the first call has an effect.
	 *
	 * @returns whether storage is available.
	 */
	async open(base64Key: string, backendFactory: () => Promise<KeyValueBackend> = openIndexedDBBackend): Promise<boolean> {
		if (this.settled) return this.ready;
		this.settled = true;
		try {
			if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is not available (no secure context?)');
			const key = await crypto.subtle.importKey('raw', base64ToBytes(base64Key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
			const backend = await backendFactory();
			if (!(await this.keyMatches(backend, key))) {
				// Written with another key, so unreadable anyway: start over.
				await backend.clear();
				await backend.put(KEY_CHECK, await this.encrypt(key, KEY_CHECK_VALUE));
			}
			this.key = key;
			this.backend = backend;
		} catch (error) {
			logger.warn('Hub storage is unavailable; keeping data in memory only', { error });
		}
		this.settle(this.available);
		return this.available;
	}

	/** Storage won't be used in this context (web, solo mode, no key). */
	disable(): void {
		if (this.settled) return;
		this.settled = true;
		this.settle(false);
	}

	/** The stored value, or undefined when there is none, it can't be read, or storage is unavailable. */
	async get<T>(name: string): Promise<T | undefined> {
		if (!(await this.ready) || !this.backend || !this.key) return undefined;
		try {
			const record = await this.backend.get(name);
			if (!record) return undefined;
			return JSON.parse(await this.decrypt(this.key, record)) as T;
		} catch (error) {
			logger.warn(`Dropping unreadable hub storage entry ${name}`, { error });
			await this.backend.delete(name).catch(() => undefined);
			return undefined;
		}
	}

	/** Store a JSON-serialisable value. Does nothing when storage is unavailable. */
	async set<T>(name: string, value: T): Promise<void> {
		if (!(await this.ready) || !this.backend || !this.key) return;
		try {
			await this.backend.put(name, await this.encrypt(this.key, JSON.stringify(value)));
		} catch (error) {
			logger.warn(`Could not store hub storage entry ${name}`, { error });
		}
	}

	async delete(name: string): Promise<void> {
		if (!(await this.ready) || !this.backend) return;
		await this.backend.delete(name).catch(() => undefined);
	}

	private async keyMatches(backend: KeyValueBackend, key: CryptoKey): Promise<boolean> {
		const check = await backend.get(KEY_CHECK);
		if (!check) return false;
		try {
			return (await this.decrypt(key, check)) === KEY_CHECK_VALUE;
		} catch {
			return false;
		}
	}

	private async encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedRecord> {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
		return { iv, data };
	}

	private async decrypt(key: CryptoKey, record: EncryptedRecord): Promise<string> {
		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.data);
		return new TextDecoder().decode(plaintext);
	}
}

/** The storage of this hub frame. */
const hubStorage = new HubStorage();

export { HubStorage, hubStorage, type KeyValueBackend };
