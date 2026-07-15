// Packages
import * as sdk from 'matrix-js-sdk';
import { type ICreateClientOpts, type MatrixClient } from 'matrix-js-sdk';

import { CONFIG } from '@hub-client/logic/logging/Config';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { useUser } from '@hub-client/stores/user';

const logger = createLogger('Authentication');

// IndexedDB.open() can hang indefinitely (no success, no error) when the browser
// blocks cross-site storage and this hub runs as a third-party iframe. Cap the
// wait so a blocked store can't stall login forever.
const INDEXEDDB_STARTUP_TIMEOUT_MS = 4000;

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
		try {
			const indexedDBStore = new sdk.IndexedDBStore({ indexedDB: window.indexedDB, dbName: `pubhubs-db-${this.user.userId}` });
			await withTimeout(indexedDBStore.startup(), INDEXEDDB_STARTUP_TIMEOUT_MS);
			return indexedDBStore;
		} catch (error) {
			logger.warn('IndexedDB sync store unavailable (blocked or unresponsive); falling back to in-memory store', { error });
			const memoryStore = new sdk.MemoryStore();
			await memoryStore.startup();
			return memoryStore;
		}
	}

	/**
	 * Actual login method
	 */

	async login() {
		this.user = useUser();

		// First check if we have an accesstoken stored
		const { auth, newToken } = this._fetchAuth();
		if (auth === null || auth.baseUrl !== this.baseUrl) {
			// There should be an accesstoken (and userId) stored, otherwise something went wrong
			throw new Error('Could not find an access token and/or userId for this hub.');
		}

		auth.timelineSupport = true;

		// Video call information supplied to synapse client about starting the video call.
		const videoCallInfo = { deviceId: 'template', useE2eForGroupCall: true, useLivekitForGroupCalls: true };
		const store = await this._createSyncStore();
		const authWithVideoCallInfo = { ...auth, ...videoCallInfo, store };

		this.client = sdk.createClient(authWithVideoCallInfo);

		if (this.client.baseUrl === this.baseUrl) {
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
