import sdk from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

import { setCookie, getCookie, removeCookie } from 'typescript-cookie'

import { User, useUser } from '@/store/store';


class Authentication {

    private user: any;

    private loginToken: string;
    private baseUrl: string;
    private clientUrl: string;
    private client!: MatrixClient;
    private cookieSettings:object;

    constructor() {
        // @ts-ignore
        this.baseUrl = _env.HUB_URL;
        this.loginToken = '';
        this.clientUrl = location.protocol + '//' + location.host + location.pathname;
        this.cookieSettings = {
            secure:true,
            sameSite:'strict',
            // domain: this.clientUrl,
        };
        // debugger; // eslint-disable-line no-debugger
    }


    /**
     * Store & Fetch locally saved access_token (TODO: More secure!!)
     */

    private _storeAuth(response: any) {
        const auth = {
            baseUrl: this.baseUrl,
            accessToken: response.access_token,
            userId: response.user_id,
        }
        this.user.setUser( new User(auth.userId) );
        setCookie("pubhub", JSON.stringify(auth), this.cookieSettings);
    }

    private _fetchAuth() {
        let auth = null;
        const stored = getCookie("pubhub");
        if (stored) {
            auth = JSON.parse(stored);
            if (auth) {
                this.user.setUser( new User(auth.userId) );
            }
        }
        return auth;
    }

    private _clearAuth() {
        removeCookie("pubhub");
    }


    /**
     * Login is handled by global PupHubs server via a SSO redirect
     */

    private _redirectToPubHubsLogin() {
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
        return new Promise((resolve,reject) => {
            // First check if we have an accesstoken stored

            const auth = this._fetchAuth();
            if ( auth !== null && auth.baseUrl == this.baseUrl ) {

                // Start client with token
                const auth = this._fetchAuth();
                auth.timelineSupport = true;
                this.client = sdk.createClient(auth);

            }
            else {

                // Start a clean client
                this.client = sdk.createClient({
                    baseUrl: this.baseUrl,
                    timelineSupport: true,
                });

            }


            // Check if we are logged in allready
            if ( !this.client.isLoggedIn() ) {


                // First check if we came back from PubHubs login flow with a loginToken
                if (this.loginToken == '') {
                    const urlParams = new URLSearchParams(window.location.search);
                    const loginTokenParam = urlParams.get('loginToken');
                    if (typeof (loginTokenParam) == "string") {
                        this.loginToken = loginTokenParam;
                    }
                }

                //  Redirect to PubHubs login if we realy don't have a token
                if (this.loginToken == '') {

                    this._redirectToPubHubsLogin();

                }
                else {

                    this.client.loginWithToken(this.loginToken).then(
                        (response: any) => {
                            window.history.pushState("", "", '/');
                            this._storeAuth(response);
                            resolve(this.client);
                        },
                        (error: any) => {
                            if ( typeof(error)=="string" && error.indexOf('Invalid login token')<0 ) {
                                console.error('ERROR:', error);
                            }
                            else {
                                // this._redirectToPubHubsLogin();
                            }
                            reject(error);
                        });

                }


            }
            else {
                if ( this.client.baseUrl == this.baseUrl ) {
                    resolve( this.client );
                }
                else {
                    resolve( false );
                }
            }

        });
    }

    logout() {
        this._clearAuth();
        this.client.logout();
        // this.client.clearStores();
        window.location.replace(this.clientUrl);
    }

}


export { Authentication }
