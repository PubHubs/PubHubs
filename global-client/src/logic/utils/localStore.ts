/**
 * LocalStore: encrypted per-user key-value store in the global client's localStorage.
 *
 * The hub client's own localStorage is unreliable (blocked in third-party iframes
 * on Safari). This module provides persistence via the global client, which runs
 * as a first-party page. Values are encrypted with a key derived from the user
 * secret so they're unreadable after logout. Keys are prefixed with a hash derived
 * from the user secret so different users' data doesn't collide or leak identity.
 */
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('LocalStore');

const STORE_PREFIX = 'ph:ls:';
const USER_SECRET_BYTES = 32;

/** SHA-256(context || rawSecret) — domain-separated key derivation. */
async function deriveBytes(rawSecret: Uint8Array, context: string): Promise<Uint8Array<ArrayBuffer>> {
	const contextBytes = new TextEncoder().encode(context);
	const input = new Uint8Array(contextBytes.length + rawSecret.length);
	input.set(contextBytes);
	input.set(rawSecret, contextBytes.length);
	return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

function bytesToHex(bytes: Uint8Array, count: number): string {
	return Array.from(bytes.slice(0, count))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** 8-byte hex prefix from user secret — collision probability ~2.7e-14 at 1000 users. */
async function deriveUserPrefix(rawSecret: Uint8Array): Promise<string> {
	return bytesToHex(await deriveBytes(rawSecret, 'ph:localstore:user-prefix'), 8);
}

/** 8-byte hex hash to hide the hubId in localStorage keys. */
async function deriveHubHash(rawSecret: Uint8Array, hubId: string): Promise<string> {
	return bytesToHex(await deriveBytes(rawSecret, 'ph:localstore:hub-id:' + hubId), 8);
}

async function deriveEncryptionKey(rawSecret: Uint8Array): Promise<CryptoKey> {
	const keyBytes = await deriveBytes(rawSecret, 'ph:localstore:encryption-key');
	return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(key: CryptoKey, plaintext: string, __only_for_testing_iv?: Uint8Array<ArrayBuffer>): Promise<string> {
	const iv = __only_for_testing_iv ?? crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return btoa(String.fromCharCode(...combined));
}

async function decrypt(key: CryptoKey, stored: string): Promise<string> {
	const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
	return new TextDecoder().decode(decrypted);
}

/**
 * Per-hub LocalStore instances for a single user. The user secret is fixed at
 * construction; on logout the entire LocalStores instance is dropped (and a
 * fresh one created on next login) so cached encryption material doesn't
 * outlive the user secret it was derived from. See useLocalStores.
 */
export class LocalStores {
	private cache = new Map<string, Promise<LocalStore>>();

	constructor(private readonly userSecretBase64: string) {}

	/** Get the cached LocalStore for a hub, or create one. */
	getOrCreate(hubId: string): Promise<LocalStore> {
		let p = this.cache.get(hubId);
		if (!p) {
			p = LocalStore.create(this.userSecretBase64, hubId);
			this.cache.set(hubId, p);
		}
		return p;
	}
}

export class LocalStore {
	private constructor(
		private readonly keyPrefix: string,
		private readonly hubHash: string,
		private readonly cryptoKey: CryptoKey,
		private readonly warn: (message: string) => void,
	) {}

	/** Create an initialized LocalStore for the given hub. */
	static async create(userSecretBase64: string, hubId: string, warn: (message: string) => void = logger.warn): Promise<LocalStore> {
		const rawSecret = Uint8Array.from(atob(userSecretBase64), (c) => c.charCodeAt(0));
		if (rawSecret.length !== USER_SECRET_BYTES) {
			throw new Error(`UserSecret must be ${USER_SECRET_BYTES} bytes, got ${rawSecret.length}`);
		}
		const [prefix, hubHash, cryptoKey] = await Promise.all([deriveUserPrefix(rawSecret), deriveHubHash(rawSecret, hubId), deriveEncryptionKey(rawSecret)]);
		return new LocalStore(STORE_PREFIX + prefix + ':', hubHash, cryptoKey, warn);
	}

	private storageKey(key: string): string {
		return this.keyPrefix + this.hubHash + ':' + key;
	}

	/** Store an encrypted value. */
	async set(key: string, value: string, __only_for_testing_iv?: Uint8Array<ArrayBuffer>): Promise<void> {
		const encrypted = await encrypt(this.cryptoKey, value, __only_for_testing_iv);
		localStorage.setItem(this.storageKey(key), encrypted);
	}

	/** Retrieve and decrypt a value, or null if not found. */
	async get(key: string): Promise<string | null> {
		const sk = this.storageKey(key);
		const raw = localStorage.getItem(sk);
		if (!raw) return null;
		try {
			return await decrypt(this.cryptoKey, raw);
		} catch {
			this.warn(`Removing unreadable LocalStore entry: ${sk}`);
			localStorage.removeItem(sk);
			return null;
		}
	}

	/** Retrieve and decrypt all key-value pairs for this hub. */
	async getAll(): Promise<Record<string, string>> {
		const hubPrefix = this.keyPrefix + this.hubHash + ':';
		const result: Record<string, string> = {};
		for (let i = 0; i < localStorage.length; i++) {
			const sk = localStorage.key(i);
			if (!sk?.startsWith(hubPrefix)) continue;
			const key = sk.slice(hubPrefix.length);
			const raw = localStorage.getItem(sk);
			if (!raw) continue;
			try {
				result[key] = await decrypt(this.cryptoKey, raw);
			} catch {
				this.warn(`Removing unreadable LocalStore entry: ${sk}`);
				localStorage.removeItem(sk);
			}
		}
		return result;
	}
}
