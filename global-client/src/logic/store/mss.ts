import { defineStore } from 'pinia';
import { assert } from 'chai';

import AuthenticationServer from '@/model/MSS/Auths.js';
import PHCServer from '@/model/MSS/PHC.js';
import Transcryptor from '@/model/MSS/Transcryptor.js';
import { AuthAttrKeyReq, EnterStartResp, InfoResp, LoginMethod, PHCEnterMode, Constellation, HubInformation } from '@/model/MSS/TMultiServerSetup.js';
import filters from '@/logic/core/filters.js';
import { hub_api } from '@/logic/core/api.js';
import { useGlobal } from '@/logic/store/global.js';

const useMSS = defineStore('mss', {
	state: () => {
		return {
			/** NOTE: Do not access this._authServer directly. Use getAuthServer() instead to make sure the server is initialized with the correct API url. */
			_authServer: null as AuthenticationServer | null,
			/** NOTE: Do not access this._transcryptor directly. Use getTranscryptor() instead to make sure the server is initialized with the correct API url. */
			_transcryptor: null as Transcryptor | null,
			phcServer: new PHCServer(),
			constellation: null as Constellation | null,
			hubs: null as Record<string, HubInformation> | null,
		};
	},

	actions: {
		async storePHCWelcomeInfo() {
			const welcomeResp = await this.phcServer.welcome();
			this.constellation = welcomeResp.constellation;
			this.hubs = welcomeResp.hubs;
		},

		async initializeServers() {
			if (!this.constellation || !this.hubs) {
				await this.storePHCWelcomeInfo();
			}
			assert.isNotNull(this.constellation);
			this._authServer = new AuthenticationServer(filters.removeTrailingSlash(this.constellation.auths_url));
			this._transcryptor = new Transcryptor(filters.removeTrailingSlash(this.constellation.transcryptor_url));
		},

		async getAuthServer() {
			if (!this._authServer) {
				await this.initializeServers();
			}
			return this._authServer!;
		},

		async getTranscryptor() {
			if (!this._transcryptor) {
				await this.initializeServers();
			}
			return this._transcryptor!;
		},

		async enterPubHubs(loginMethod: LoginMethod, enterMode: PHCEnterMode) {
			const authServer = await this.getAuthServer();

			const { identifyingAttr, signedIdentifyingAttrs, signedAddAttrs } = await authServer.startAuthentication(loginMethod, enterMode);
			const { entered, errorMessage, objectDetails, userSecretObject } = await this.phcServer.login(identifyingAttr, signedAddAttrs, enterMode);
			if (!entered) {
				return errorMessage;
			}
			// Request attribute keys for all identifying attributes used to login.
			const attrKeyReq: AuthAttrKeyReq = {};
			for (const [handle, attr] of Object.entries(signedIdentifyingAttrs)) {
				if (userSecretObject && userSecretObject[attr.id][attr.value]) {
					attrKeyReq[handle] = { attr: attr.signedAttr, timestamp: userSecretObject[attr.id][attr.value].ts };
				} else {
					attrKeyReq[handle] = { attr: attr.signedAttr, timestamp: null };
				}
			}
			const attrKeyResp = await authServer.attrKeysEP(attrKeyReq);
			if ('RetryWithNewAttr' in attrKeyResp) {
				const global = useGlobal();
				global.logout();
				return { key: 'errors.retry_with_new_attr' };
			} else if ('Success' in attrKeyResp) {
				await this.phcServer.storeUserSecretObject(attrKeyResp.Success, signedIdentifyingAttrs, userSecretObject, objectDetails);
			}
		},

		async getHubs() {
			if (!this.hubs) {
				await this.storePHCWelcomeInfo();
			}
			assert.isNotNull(this.hubs);
			return Object.values(this.hubs);
		},

		async requestUserObject(handle: string) {
			const object = await this.phcServer.getDecryptedUserObject(handle);
			return object;
		},

		async storeUserObject<T>(handle: string, data: T) {
			const object = await this.phcServer.getUserObject(handle);
			let overwriteHash: string | undefined = undefined;
			if (object) {
				// If the object already exists, the hash is needed to overwrite the object
				overwriteHash = object.details.hash;
			}
			await this.phcServer.storeObject<T>(handle, data, overwriteHash);
		},

		async getHubInfo(hubServerUrl: string): Promise<InfoResp> {
			const infoResp = await hub_api.api<InfoResp>(`${hubServerUrl}${hub_api.apiURLS.info}`);
			return infoResp;
		},

		async enterHub(id: string, nonceStatePair: EnterStartResp) {
			const maxAttempts = 3;
			for (let attempts = 0; attempts < maxAttempts; attempts++) {
				const sealedPPP = await this.phcServer.pppEP();
				assert.isDefined(sealedPPP, 'Something went wrong, sealedPPP should be defined.');
				const transcryptor = await this.getTranscryptor();
				const sealedEhpp = await transcryptor.ehppEP(nonceStatePair.nonce, id, sealedPPP);
				// TODO Floris: add a delay after every check
				if (sealedEhpp === 'RetryWithNewPpp' && attempts < maxAttempts) continue;
				else if (sealedEhpp === 'RetryWithNewPpp') throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				assert.isDefined(sealedEhpp, 'Something went wrong, sealedEhpp should be defined or you should have gone back to requesting a new Ppp.');
				const signedHhpp = await this.phcServer.hhppEP(sealedEhpp);
				if (signedHhpp === 'RetryWithNewPpp' && attempts < maxAttempts) continue;
				else if (signedHhpp === 'RetryWithNewPpp') throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				assert.isDefined(signedHhpp, 'Something went wrong, signedHhpp should be defined or you should have logged out or gone back to requesting a new Ppp.');
				return signedHhpp;
			}
		},
	},
});

export { useMSS };
