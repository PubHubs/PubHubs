// Packages
import * as sdk from 'matrix-js-sdk';
import { type ICreateClientOpts, type MatrixClient } from 'matrix-js-sdk';

import { api_matrix } from '@hub-client/logic/core/api';
import { trackedFetch } from '@hub-client/logic/core/reachability';
import { CONFIG } from '@hub-client/logic/logging/Config';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { useUser } from '@hub-client/stores/user';

const logger = createLogger('Authentication');

// A hub client runs as a third-party iframe — its origin differs from the global client's — and
// Safari blocks cross-site storage by default, in which case indexedDB.open() never settles: no
// success, no error. A single timeout used to cover both that and the time it takes to load a real
// sync cache, which forces a bad trade either way. Long enough not to discard a working cache on a
// slow phone means stalling every blocked load for just as long, on every hub entry, every hub
// switch, and in every miniclient; short enough to keep those snappy means throwing away a cache
// that was merely slow to load, and re-syncing the hub from scratch for no reason.
//
// So ask the two questions separately. Opening a throwaway database answers "may this context use
// storage at all?" — in milliseconds when the answer is yes, and never when the answer is no.
const INDEXEDDB_PROBE_TIMEOUT_MS = 750;
const INDEXEDDB_PROBE_DB_NAME = 'pubhubs-storage-probe';

// Only once storage is known to work does the real store open, and then it may take as long as
// loading a large cache honestly takes. This cap is a backstop against a pathological hang, not a
// judgement about the platform — that judgement has already been made by the probe.
const INDEXEDDB_STARTUP_TIMEOUT_MS = 30_000;

/**
 * Whether this context may use IndexedDB at all, decided by opening and discarding a tiny database.
 * Resolves `false` rather than rejecting: a blocked frame is an expected environment here, not an
 * error, and the caller's next step is the same in every failing case.
 */
function indexedDBIsUsable(): Promise<boolean> {
	if (!window.indexedDB) return Promise.resolve(false);

	return new Promise<boolean>((resolve) => {
		let settled = false;
		const finish = (usable: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(usable);
		};
		const timer = setTimeout(() => finish(false), INDEXEDDB_PROBE_TIMEOUT_MS);

		try {
			const request = window.indexedDB.open(INDEXEDDB_PROBE_DB_NAME);
			request.onsuccess = () => {
				request.result.close();
				// Best effort — a refused delete only leaves an empty database behind.
				window.indexedDB.deleteDatabase(INDEXEDDB_PROBE_DB_NAME);
				finish(true);
			};
			request.onerror = () => finish(false);
			request.onblocked = () => finish(false);
		} catch {
			// Some blocked configurations throw SecurityError from open() outright.
			finish(false);
		}
	});
}

/** Reject if the promise doesn't settle within `ms`. The original promise keeps running. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms} ms`)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

class Authentication {
	private user = useUser();

	private localDevelopmentAccessToken: string = '';
	private baseUrl: string;
	private clientUrl: string;
	private client!: MatrixClient;

	/** Whether this device's encryption started, so it can take part in anything end-to-end encrypted (today: video calls). Set by login(). */
	public e2eeAvailable = false;

	constructor() {
		this.baseUrl = CONFIG._env.HUB_URL;
		this.clientUrl = location.protocol + '//' + location.host + location.pathname;
	}

	/**
	 * Set user based on access token and send token and userId to global client for storage.
	 */
	private _storeAccessTokenAndUserId(accessToken: string, userId: string) {
		this.localDevelopmentAccessToken = accessToken;
		this.user.setUserId(userId);
		useMessageBox().sendMessage(
			new Message(
				MessageType.AddAuthInfo,
				JSON.stringify({
					token: accessToken,
					userId: userId,
				}),
			),
		);
	}

	private _fetchAuth() {
		const auth: ICreateClientOpts = { baseUrl: this.baseUrl };
		const query = new URLSearchParams(window.location.search);
		const newToken = query.get('newToken');
		const token = query.get('accessToken');
		if (token) {
			const access = JSON.parse(token);
			const accessToken = access.token;
			const userId = access.userId;
			if (accessToken && userId) {
				auth.accessToken = accessToken;
				auth.userId = userId;
				this.user.setUserId(auth.userId ?? '');
			}
		}
		return { auth, newToken };
	}

	private _clearAuth() {
		useMessageBox().sendMessage(new Message(MessageType.RemoveAccessToken));
	}

	public getAccessToken(): string | null {
		const { auth } = this._fetchAuth();
		if (auth.accessToken) {
			return auth.accessToken;
		}
		if (this.localDevelopmentAccessToken) {
			return this.localDevelopmentAccessToken;
		}

		return null;
	}

	/**
	 * Login is handled by global PubHubs server via a SSO redirect. This function should only be used when running the hub client outside of the
	 * global client.
	 */

	// public redirectToPubHubsLogin() {
	// 	this.client = sdk.createClient({
	// 		baseUrl: this.baseUrl,
	// 	});
	// 	this.baseUrl = window.location.href;
	// 	const ssoURL = this.client.getSsoLoginUrl(this.baseUrl);
	// 	window.location.replace(ssoURL);
	// }

	/**
	 * Create the matrix sync store. Prefers IndexedDB for an on-disk sync cache,
	 * but falls back to an in-memory store when IndexedDB is unavailable, blocked,
	 * or unresponsive (its open() can hang silently in a storage-blocked iframe).
	 * With the in-memory store the hub still loads; it just re-syncs from scratch
	 * each session instead of using a persisted cache.
	 */
	private async _createSyncStore(): Promise<ICreateClientOpts['store']> {
		if (!(await indexedDBIsUsable())) {
			logger.warn('IndexedDB is blocked or unresponsive in this context; using an in-memory store, so this session re-syncs from scratch');
			return this._createMemoryStore();
		}

		try {
			const indexedDBStore = new sdk.IndexedDBStore({ indexedDB: window.indexedDB, dbName: `pubhubs-db-${this.user.userId}` });
			await withTimeout(indexedDBStore.startup(), INDEXEDDB_STARTUP_TIMEOUT_MS);
			return indexedDBStore;
		} catch (error) {
			logger.warn('IndexedDB sync store failed to start; falling back to in-memory store', { error });
			return this._createMemoryStore();
		}
	}

	private async _createMemoryStore(): Promise<ICreateClientOpts['store']> {
		const memoryStore = new sdk.MemoryStore();
		await memoryStore.startup();
		return memoryStore;
	}

	// Every hub entry registers a new device, and a crypto store belongs to exactly one device.
	private _cryptoDatabasePrefix(): string {
		return `pubhubs-crypto-${this.user.userId}-${this.client.getDeviceId()}`;
	}

	/**
	 * Delete the crypto stores of this user's earlier devices: those devices are gone, so their stores can never be used again.
	 * Done at login because logging out happens in the global client, which cannot reach this hub's storage.
	 */
	private async _deleteStaleCryptoStores(): Promise<void> {
		if (!window.indexedDB.databases) return;

		const userPrefix = `pubhubs-crypto-${this.user.userId}-`;
		const ownPrefix = `${this._cryptoDatabasePrefix()}::`;
		try {
			for (const { name } of await window.indexedDB.databases()) {
				if (name?.startsWith(userPrefix) && !name.startsWith(ownPrefix)) {
					window.indexedDB.deleteDatabase(name);
				}
			}
		} catch (error) {
			logger.warn('Could not clean up crypto stores of earlier devices', { error });
		}
	}

	/**
	 * Whether this device's crypto store is gone (e.g. browser storage cleared, or Safari purging iframe storage)
	 * while Synapse still holds keys it uploaded earlier. If anything is uncertain, answers false.
	 */
	private async _deviceLostItsKeys(): Promise<boolean> {
		if (!window.indexedDB.databases) return false;

		const storeName = `${this._cryptoDatabasePrefix()}::matrix-sdk-crypto`;
		try {
			const databases = await window.indexedDB.databases();
			if (databases.some(({ name }) => name === storeName)) return false;

			const userId = this.user.userId ?? '';
			const deviceId = this.client.getDeviceId() ?? '';
			const response = await api_matrix.apiPOST<{ device_keys?: Record<string, Record<string, unknown>> }>(api_matrix.apiURLS.keysQuery, {
				device_keys: { [userId]: [deviceId] },
			});
			return !!response.device_keys?.[userId]?.[deviceId];
		} catch (error) {
			logger.warn('Could not check whether this device still has its encryption keys', { error });
			return false;
		}
	}

	/**
	 * Start client-side encryption, used for end-to-end encrypted video calls. Must run before the client starts
	 * syncing: matrix-js-sdk wires the crypto backend into the sync when startClient() runs.
	 * Never throws — without encryption the hub still works, only video calls are unavailable.
	 */
	private async _initCrypto(): Promise<boolean> {
		// The crypto store keeps its own IndexedDB database, independent of the sync store, and must survive a reload:
		// an in-memory one would mint new identity keys for an existing device, which Synapse rejects.
		if (!(await indexedDBIsUsable())) {
			logger.warn('No persistent storage in this context; end-to-end encrypted video calls are unavailable');
			return false;
		}

		await this._deleteStaleCryptoStores();
		if (await this._deviceLostItsKeys()) {
			// Synapse refuses new keys for a device that already has some, so this device can never encrypt again.
			// Asking the global client for a new access token gets this hub a fresh device.
			logger.warn('This device lost its encryption keys; requesting a new device');
			this._clearAuth();
			return false;
		}
		try {
			await this.client.initRustCrypto({ cryptoDatabasePrefix: this._cryptoDatabasePrefix() });
			return true;
		} catch (error) {
			logger.error('Could not start encryption; end-to-end encrypted video calls are unavailable', { error });
			return false;
		}
	}

	/**
	 * Actual login method
	 */

	async login(options: { withCrypto?: boolean } = {}) {
		this.user = useUser();

		// First check if we have an accesstoken stored
		const { auth, newToken } = this._fetchAuth();
		if (auth === null || auth.baseUrl !== this.baseUrl) {
			// There should be an accesstoken (and userId) stored, otherwise something went wrong
			throw new Error('Could not find an access token and/or userId for this hub.');
		}

		auth.timelineSupport = true;

		// The client must know the device Synapse issued with this token: per-device keys (e.g. video call E2EE) are addressed to it.
		api_matrix.setAccessToken(auth.accessToken ?? '');
		const [store, { device_id: deviceId }] = await Promise.all([
			this._createSyncStore(),
			api_matrix.apiGET<{ device_id: string }>(api_matrix.apiURLS.whoami),
		]);

		// Video call information supplied to synapse client about starting the video call.
		const videoCallInfo = { deviceId, useE2eForGroupCall: true, useLivekitForGroupCalls: true };
		// trackedFetch keeps the hub server's reachability state current (logic/core/reachability.ts).
		const authWithVideoCallInfo = { ...auth, ...videoCallInfo, store, fetchFn: trackedFetch };

		this.client = sdk.createClient(authWithVideoCallInfo);

		if (this.client.baseUrl === this.baseUrl) {
			if (options.withCrypto) {
				this.e2eeAvailable = await this._initCrypto();
			}
			if (newToken === 'true' && auth.accessToken && auth.userId) {
				this._storeAccessTokenAndUserId(auth.accessToken, auth.userId);
			}
			return this.client;
		} else {
			return false;
		}
	}

	logout() {
		this._clearAuth();
		window.location.replace(this.clientUrl);
	}

	getBaseUrl() {
		return this.baseUrl;
	}
}

export { Authentication };
