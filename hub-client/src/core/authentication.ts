import * as sdk from 'matrix-js-sdk';
import { MatrixClient, ICreateClientOpts } from 'matrix-js-sdk';

import { useUser, useDialog, useMessageBox, Message, MessageType } from '@/store/store';

type loginResponse = {
	access_token: string;
	user_id: string;
};

class Authentication {
	private user = useUser();

	private loginToken: string;
	private localDevelopmentAccessToken: string = '';
	private baseUrl: string;
	private clientUrl: string;
	private client!: MatrixClient;

	constructor() {
		// @ts-ignore
		this.baseUrl = _env.HUB_URL;
		this.loginToken = '';
		this.clientUrl = location.protocol + '//' + location.host + location.pathname;
	}

	/**
	 * Set user based on access token and send token to global client for storage.
	 */

	private _storeAuth(response: loginResponse) {
		const auth = {
			baseUrl: this.baseUrl,
			accessToken: response.access_token,
			userId: response.user_id,
			loginTime: String(Date.now()),
		};
		this.localDevelopmentAccessToken = auth.accessToken;
		this.user.setUserId(auth.userId);
		useMessageBox().sendMessage(new Message(MessageType.AddAccessToken, JSON.stringify({ token: response.access_token, userId: response.user_id })));
	}

	private _fetchAuth() {
		const auth: ICreateClientOpts = { baseUrl: this.baseUrl };
		const query = new URLSearchParams(window.location.search).get('accessToken');
		if (query) {
			const access = JSON.parse(query);
			const accessToken = access.token;
			const userId = access.userId;
			if (accessToken && userId) {
				auth.accessToken = accessToken;
				auth.userId = userId;
				this.user.setUserId(auth.userId!);
			}
		}
		return auth;
	}

	private _clearAuth() {
		useMessageBox().sendMessage(new Message(MessageType.RemoveAccessToken));
	}

	public getAccessToken(): string | null {
		const auth = this._fetchAuth();
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
			const auth = this._fetchAuth();
			if (auth !== null && auth.baseUrl === this.baseUrl) {
				// Start client with token
				const auth = this._fetchAuth();
				auth.timelineSupport = true;
				this.client = sdk.createClient(auth);
			} else {
				// Start a clean client
				this.client = sdk.createClient({
					baseUrl: this.baseUrl,
					timelineSupport: true,
				});
			}

			// Check if we are logged in already
			if (!this.client.isLoggedIn()) {
				// First check if we came back from PubHubs login flow with a loginToken
				if (this.loginToken === '') {
					const urlParams = new URLSearchParams(window.location.search);
					const loginTokenParam = urlParams.get('loginToken');
					if (typeof loginTokenParam === 'string') {
						this.loginToken = loginTokenParam;
					}
				}
				//  Redirect to PubHubs login if we realy don't have a token
				if (this.loginToken === '') {
					this.redirectToPubHubsLogin();
				} else {
					this.client.loginWithToken(this.loginToken).then(
						(response) => {
							window.history.pushState('', '', '/');
							this._storeAuth(response as loginResponse);
							resolve(this.client);
						},
						(error) => {
							const err = error.data;
							const dialog = useDialog();

							if (typeof error === 'string' && error.indexOf('Invalid login token') < 0) {
								dialog.confirm('Server Error', error).then(() => {
									reject(error);
								});
							} else if (error.data.errcode === 'M_LIMIT_EXCEEDED') {
								const message = `Too much login attempts.Try again in ${[Math.round(err.retry_after_ms / 1000)]} seconds.`;
								dialog.confirm('Server Error', message).then(() => {
									reject(error);
								});
							} else {
								console.error(error);
							}

							reject(error);
						},
					);
				}
			} else {
				if (this.client.baseUrl === this.baseUrl) {
					resolve(this.client);
				} else {
					resolve(false);
				}
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
