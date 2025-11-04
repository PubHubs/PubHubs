// Packages
import * as sdk from 'matrix-js-sdk';
import { ICreateClientOpts, MatrixClient } from 'matrix-js-sdk';

import { CONFIG } from '@hub-client/logic/logging/Config';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { useUser } from '@hub-client/stores/user';

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
				this.user.setUserId(auth.userId!);
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

	public redirectToPubHubsLogin() {
		this.client = sdk.createClient({
			baseUrl: this.baseUrl,
		});
		this.baseUrl = window.location.href;
		const ssoURL = this.client.getSsoLoginUrl(this.baseUrl);
		window.location.replace(ssoURL);
	}

	/**
	 * Actual login method
	 */

	login() {
		this.user = useUser();
		return new Promise((resolve, reject) => {
			// First check if we have an accesstoken stored
			const { auth, newToken } = this._fetchAuth();
			if (auth !== null && auth.baseUrl === this.baseUrl) {
				auth.timelineSupport = true;
				this.client = sdk.createClient(auth);
			} else {
				// There should be an accesstoken (and userId) stored, otherwise something went wrong
				reject('Could not find an access token and/or userId for this hub.');
			}

			if (this.client.baseUrl === this.baseUrl) {
				if (newToken === 'true' && auth.accessToken && auth.userId) {
					this._storeAccessTokenAndUserId(auth.accessToken, auth.userId);
				}
				resolve(this.client);
			} else {
				resolve(false);
			}
		});
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
