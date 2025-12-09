// Packages
import { assert } from 'chai';
import { defineStore } from 'pinia';

// Logic
import { hub_api } from '@global-client/logic/core/api';
import { delay } from '@global-client/logic/utils/generalUtils';
import { decodeJWT, handleErrors, responseEqualToRequested } from '@global-client/logic/utils/mssUtils';
import { startYiviAuthentication } from '@global-client/logic/utils/yiviHandler';

import filters from '@hub-client/logic/core/filters';

// Models
import AuthenticationServer from '@global-client/models/MSS/Auths';
import PHCServer from '@global-client/models/MSS/PHC';
import { AuthAttrKeyReq, AuthStartReq, CardReq, LoginMethod, Source } from '@global-client/models/MSS/TAuths';
import { DecodedAttributes, EnterStartResp, HubInfoResp, InfoResp, ResultResponse, ReturnCard, isResult } from '@global-client/models/MSS/TGeneral';
import { Attr, Constellation, HubInformation, PHCEnterMode, isUserSecretObjectNew } from '@global-client/models/MSS/TPHC';
import Transcryptor from '@global-client/models/MSS/Transcryptor';

// Stores
import { useGlobal } from '@global-client/stores/global';

const useMSS = defineStore('mss', {
	state: () => {
		return {
			// * NOTE: Do not access this._authServer directly. Use getAuthServer() instead to make sure the server is initialized with the correct API url.
			_authServer: null as AuthenticationServer | null,
			// * NOTE: Do not access this._transcryptor directly. Use getTranscryptor() instead to make sure the server is initialized with the correct API url.
			_transcryptor: null as Transcryptor | null,
			phcServer: new PHCServer(),
			constellation: null as Constellation | null,
			hubs: null as Record<string, HubInformation> | null,
		};
	},

	actions: {
		async enterPubHubs(loginMethod: LoginMethod, enterMode: PHCEnterMode): Promise<{ key: string; values?: string[] } | undefined> {
			const authServer = await this.getAuthServer();

			// 1. Fetch supported attr types
			const supported = await authServer.welcomeEPAuths();
			const identifyingAttrs = authServer.checkAttributes(supported, loginMethod, enterMode);

			// 2. Build auth start request
			const authStartReq: AuthStartReq =
				enterMode === PHCEnterMode.LoginOrRegister
					? { source: loginMethod.source, attr_types: loginMethod.register_attr, attr_type_choices: [], yivi_chained_session: true }
					: { source: loginMethod.source, attr_types: [], attr_type_choices: loginMethod.login_choices, yivi_chained_session: false };

			// 3. Start authentication
			const { task, state } = await authServer.authStartEP(authStartReq);
			authServer.setState(state);

			// 4. Handle Yivi task
			if (loginMethod.source !== Source.Yivi || !task.Yivi) {
				throw new Error(`Task mismatch for source ${loginMethod.source}: ${JSON.stringify(task)}`);
			}
			const { disclosure_request, yivi_requestor_url } = task.Yivi;
			const yiviUrl = filters.removeTrailingSlash(yivi_requestor_url);

			// Disclose attributes in Yivi
			let proof: { Yivi: { disclosure: string } };

			if (enterMode === PHCEnterMode.LoginOrRegister) {
				startYiviAuthentication(yiviUrl, disclosure_request);
				const jwt = await authServer.YiviWaitForResultEP(authServer.getState());
				if (!(ResultResponse.Success in jwt)) throw new Error('Restart authentication please');
				proof = { Yivi: jwt.Success };
			} else {
				const disclosure = await startYiviAuthentication(yiviUrl, disclosure_request);
				proof = { Yivi: { disclosure } };
			}

			// 5. Complete authentication
			const authSuccess = await authServer.completeAuthEP(proof, authServer.getState());

			// 6. Validate attributes
			this.validateAttributes(authSuccess, enterMode, loginMethod);

			// 7. Decode attributes
			const { identifying, additional } = this.decodeSignedAttributes(authSuccess.attrs, identifyingAttrs);

			// 8. Enter PubHubs
			// ? If there are several identifying attributes pick the first one
			const identifyingHandle = Object.keys(identifying)[0];
			const identifyingAttr = authSuccess.attrs[identifyingHandle];
			const { entered, errorMessage } = await this.phcServer.enter(additional, enterMode, identifyingAttr);
			if (!entered) return errorMessage;

			// Load updated state
			await this.phcServer.stateEP();
			// Load Secret objects
			const userSecret = await this.phcServer.getUserSecretObject();
			const objectDetails = userSecret?.details ?? null;
			const userSecretObject = userSecret?.object ?? null;

			// 9. Issue a Pubhubs card if registering a new account
			if (enterMode === PHCEnterMode.LoginOrRegister) {
				const allDecodedAttrs = Object.entries(authSuccess.attrs).map(([handle, signedAttr]) => ({ handle, attr: decodeJWT(signedAttr) as Attr }));
				const comment = '\nCard issued with the following attributes:\n' + allDecodedAttrs.map(({ handle, attr }) => `${handle}: ${attr.value}`).join('\n');
				const { cardAttr, errorMessage } = await this.issueCard(true, comment);
				if (!cardAttr) return errorMessage;
				identifying['ph_card'] = cardAttr;
			}

			// 10. Get attribute Key Response
			const attrKeyReq: AuthAttrKeyReq = this.buildAttributeKeyRequest(identifying, userSecretObject);
			const attrKeyResp = await authServer.attrKeysEP(attrKeyReq);

			if ('RetryWithNewAttr' in attrKeyResp) {
				useGlobal().logout();
				return { key: 'errors.retry_with_new_attr' };
			}

			// 11. Store user secret objects
			if (ResultResponse.Success in attrKeyResp) {
				await this.phcServer.storeUserSecretObject(attrKeyResp.Success, identifying, userSecretObject, objectDetails);
			}
		},

		async enterHub(id: string, nonceStatePair: EnterStartResp): Promise<string | undefined> {
			const maxAttempts = 4;
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				if (attempt > 0) {
					delay(attempt - 1);
				}

				const sealedPPP = await this.phcServer.pppEP();
				assert.isDefined(sealedPPP, 'Something went wrong, sealedPPP should be defined.');
				const transcryptor = await this.getTranscryptor();
				const sealedEhpp = await transcryptor.ehppEP(nonceStatePair.nonce, id, sealedPPP);

				if (sealedEhpp === 'RetryWithNewPpp' && attempt < maxAttempts) {
					continue;
				} else if (sealedEhpp === 'RetryWithNewPpp') {
					throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				}
				assert.isDefined(sealedEhpp, 'Something went wrong, sealedEhpp should be defined or you should have gone back to requesting a new Ppp.');
				const signedHhpp = await this.phcServer.hhppEP(sealedEhpp);

				if (signedHhpp === 'RetryWithNewPpp' && attempt < maxAttempts) {
					continue;
				} else if (signedHhpp === 'RetryWithNewPpp') {
					throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				}
				assert.isDefined(signedHhpp, 'Something went wrong, signedHhpp should be defined or you should have logged out or gone back to requesting a new Ppp.');
				return signedHhpp;
			}
		},

		async issueCard(chainedSession: boolean, comment: string, identifyingAttr?: string): Promise<ReturnCard> {
			const authServer = await this.getAuthServer();

			// 1. Fetch pseudo card package from the Pubhubs Central Server
			const pseudoRespSuccess = await this.phcServer.cardPseudePackage();
			const cardReq: CardReq = {
				card_pseud_package: pseudoRespSuccess,
				comment: comment,
			};

			// 2. Get signed card attribute from Auth server
			const cardRespSuccess = await authServer.CardEP(cardReq);
			const { attr: signedCardAttr, issuance_request, yivi_requestor_url } = cardRespSuccess;

			// 3. Add card attribute to PubHubs Central Server
			const { entered, errorMessage } = await this.phcServer.enter([signedCardAttr], PHCEnterMode.Login, identifyingAttr);
			if (!entered) {
				return { cardAttr: null, errorMessage };
			}
			// 4. Add card to Yivi
			if (chainedSession) {
				await authServer.YiviReleaseNextSessionEP({
					state: authServer.getState(),
					next_session: issuance_request,
				});
			} else {
				const yiviUrl = filters.removeTrailingSlash(yivi_requestor_url);
				await startYiviAuthentication(yiviUrl, issuance_request);
			}
			// 5. Decode and return card
			const decoded = decodeJWT(signedCardAttr) as Attr;

			return {
				cardAttr: {
					signedAttr: signedCardAttr,
					id: decoded.attr_type,
					value: decoded.value,
				},
				errorMessage: null,
			};
		},
		async storePHCWelcomeInfo(): Promise<void> {
			const welcomeResp = await this.phcServer.welcome();
			this.constellation = welcomeResp.constellation;
			this.hubs = welcomeResp.hubs;
		},

		async initializeServers(): Promise<void> {
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

		async getTranscryptor(): Promise<{
			ehppEP: (nonce: string, id: string, ppp: string) => Promise<string>;
		}> {
			if (!this._transcryptor) {
				await this.initializeServers();
			}
			return this._transcryptor!;
		},

		logout(): void {
			this.phcServer.reset();
			localStorage.removeItem('PHauthToken');
			localStorage.removeItem('UserSecret');
			localStorage.removeItem('UserSecretVersion');
		},
		async getHubs(): Promise<HubInformation[]> {
			if (!this.hubs) {
				await this.storePHCWelcomeInfo();
			}
			assert.isNotNull(this.hubs);
			return Object.values(this.hubs);
		},

		async requestUserObject(handle: string): Promise<string | null> {
			const object = await this.phcServer.getDecryptedUserObject(handle);
			return object;
		},

		async storeUserObject<T>(handle: string, data: T): Promise<void> {
			const object = await this.phcServer.getUserObject(handle);
			let overwriteHash: string | undefined = undefined;
			if (object) {
				// If the object already exists, the hash is needed to overwrite the object
				overwriteHash = object.details.hash;
			}
			await this.phcServer.encryptAndStoreObject<T>(handle, data, overwriteHash);
		},

		async getHubInfo(hubServerUrl: string): Promise<InfoResp> {
			const infoResp = await hub_api.api<HubInfoResp | InfoResp>(`${hubServerUrl}${hub_api.apiURLS.info}`);

			// hubs <= v3.0.0 do not wrap the info response in an "Ok": { ... }
			if (isResult(infoResp)) {
				return await handleErrors<InfoResp>(() => Promise.resolve(infoResp));
			}

			return infoResp;
		},

		decodeSignedAttributes(attributes: Record<string, string>, identifyingAttrs: Set<string>): DecodedAttributes {
			const identifying: Record<string, { signedAttr: string; id: string; value: string }> = {};
			const additional: string[] = [];

			for (const [handle, signedAttr] of Object.entries(attributes)) {
				const decoded = decodeJWT(signedAttr) as Attr;

				if (identifyingAttrs.has(handle)) {
					identifying[handle] = {
						signedAttr,
						id: decoded.attr_type,
						value: decoded.value,
					};
				} else {
					additional.push(signedAttr);
				}
			}

			if (Object.keys(identifying).length === 0) {
				throw new Error('Identifying attribute missing in authentication response.');
			}

			return { identifying, additional };
		},
		validateAttributes(authSuccess: { attrs: {} }, enterMode: PHCEnterMode, loginMethod: LoginMethod): void {
			const keys = Object.keys(authSuccess.attrs);
			let allowedAttributeSets: string[][];

			if (enterMode === PHCEnterMode.LoginOrRegister) {
				allowedAttributeSets = [loginMethod.register_attr];
			} else {
				// At least one of the choices need to match for login
				allowedAttributeSets = loginMethod.login_choices.flat().map((attr) => [attr]);
			}

			const isValid = allowedAttributeSets.some((set) => responseEqualToRequested(keys, set));
			if (!isValid) {
				throw new Error('Disclosed attributes do not match the requested ones.');
			}
		},
		buildAttributeKeyRequest(signedIdentifyingAttrs: Record<string, { id: string; value: string; signedAttr: any }>, userSecretObject: any): AuthAttrKeyReq {
			const attrKeyReq: AuthAttrKeyReq = {};

			for (const [handle, attr] of Object.entries(signedIdentifyingAttrs)) {
				let timestamp = null;

				if (isUserSecretObjectNew(userSecretObject)) {
					timestamp = userSecretObject?.data?.[attr.id]?.[attr.value]?.ts ?? null;
				} else if (userSecretObject) {
					timestamp = userSecretObject?.[attr.id]?.[attr.value]?.ts ?? null;
				}

				attrKeyReq[handle] = {
					attr: attr.signedAttr,
					timestamp,
				};
			}

			return attrKeyReq;
		},
	},
});

export { useMSS };
