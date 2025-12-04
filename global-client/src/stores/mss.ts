// Packages
import { assert } from 'chai';
import { defineStore } from 'pinia';

// Logic
import { hub_api } from '@global-client/logic/core/api';
import { startYiviAuthentication } from '@global-client/logic/utils/yiviHandler';

import filters from '@hub-client/logic/core/filters';

// Models
import AuthenticationServer, { handleErrors } from '@global-client/models/MSS/Auths';
import PHCServer from '@global-client/models/MSS/PHC';
import { AuthAttrKeyReq, AuthStartReq, CardReq, LoginMethod, SignedIdentifyingAttrs, Source } from '@global-client/models/MSS/TAuths';
import { EnterStartResp, HubInfoResp, InfoResp, ResultResponse, isResult } from '@global-client/models/MSS/TGeneral';
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

		async issueCard(chainedSession: boolean, comment: string, identifyingAttr?: string) {
			const authServer = await this.getAuthServer();

			// 1. Fetch pseudo card package from the Pubhubs Central Server
			const pseudoResp = await this.phcServer.cardPseudePackage();
			if (!(ResultResponse.Success in pseudoResp)) {
				throw new Error('Retreiving the Pseudo card package failed — retry with a new Authtoken.');
			}

			const cardReq: CardReq = {
				card_pseud_package: pseudoResp.Success,
				comment: comment,
			};

			// 2. Get signed card attribute from Auth server
			const cardResp = await authServer.CardEP(cardReq);
			if (!(ResultResponse.Success in cardResp)) {
				throw new Error('Card issuance failed — retry with a new PseudoCard.');
			}

			const { attr: signedCardAttr, issuance_request, yivi_requestor_url } = cardResp.Success;

			// 3. Add card attribute to PubHubs Central Server
			const { entered, errorMessage } = await this.phcServer.enter([signedCardAttr], PHCEnterMode.Login, identifyingAttr);
			if (!entered) {
				return { cardAttr: null, errorMessage };
			}
			// 4. Add card to Yivi
			if (chainedSession) {
				const releaseResp = await authServer.YiviReleaseNextSessionEP({
					state: authServer.getState(),
					next_session: issuance_request,
				});
				if (!(ResultResponse.Success in releaseResp)) {
					throw new Error('Failed to add the card to the Yivi chained session.');
				}
			} else {
				const yiviUrl = filters.removeTrailingSlash(yivi_requestor_url);
				await startYiviAuthentication(yiviUrl, issuance_request);
				// What to do if the disclosure fails?
			}
			// 5. Decode and return card
			const decoded = authServer.decodeJWT(signedCardAttr) as Attr;

			return {
				cardAttr: {
					signedAttr: signedCardAttr,
					id: decoded.attr_type,
					value: decoded.value,
				},
				errorMessage: null,
			};
		},

		async enterPubHubs(loginMethod: LoginMethod, enterMode: PHCEnterMode): Promise<{ key: string; values?: string[] } | undefined> {
			const authServer = await this.getAuthServer();

			// 1. Fetch supported attr types
			const supported = await authServer.welcomeEPAuths();
			const identifyingAttrs = authServer.checkAttributes(supported, loginMethod, enterMode);

			// 2. Build auth start request
			const authStartReq: AuthStartReq =
				enterMode === PHCEnterMode.LoginOrRegister
					? {
							source: loginMethod.source,
							attr_types: loginMethod.register_attr,
							attr_type_choices: [],
							yivi_chained_session: true,
						}
					: {
							source: loginMethod.source,
							attr_types: [],
							attr_type_choices: loginMethod.login_choices,
							yivi_chained_session: false,
						};

			// 3. Start authentication
			const startResp = await authServer.authStartEP(authStartReq);
			if ('UnknownAttrType' in startResp) {
				throw new Error(`Unknown attribute handle: ${startResp.UnknownAttrType}`);
			}
			if ('SourceNotAvailableFor' in startResp) {
				throw new Error(`Source ${authStartReq.source} not available for attribute: ${startResp.SourceNotAvailableFor}`);
			}
			if (!(ResultResponse.Success in startResp)) {
				throw new Error('Unexpected response from startAuth.');
			}

			// 4. Handle Yivi task
			const { task, state } = startResp.Success;
			authServer.setState(state);
			if (loginMethod.source !== Source.Yivi || !task.Yivi) {
				throw new Error(`Task mismatch for source ${loginMethod.source}: ${JSON.stringify(task)}`);
			}
			const { disclosure_request, yivi_requestor_url } = task.Yivi;
			const yiviUrl = filters.removeTrailingSlash(yivi_requestor_url);

			// Disclose a Pubhubs card in Yivi
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
			if (!authSuccess) {
				throw new Error('Authentication completed with no data.');
			}

			// 6. Validate attributes
			const keys = Object.keys(authSuccess.attrs);
			let allowedAttributeSets: string[][];
			if (enterMode === PHCEnterMode.LoginOrRegister) {
				allowedAttributeSets = [['email', 'phone']];
			} else {
				allowedAttributeSets = [['ph_card'], ['email']];
			}
			const isValid = allowedAttributeSets.some((set) => authServer.responseEqualToRequested(keys, set));
			if (!isValid) {
				throw new Error('Disclosed attributes do not match the requested ones.');
			}

			// 7. Collect attributes
			const signedIdentifyingAttrs: SignedIdentifyingAttrs = {};
			const signedAddAttrs: string[] = [];
			let identifyingHandle: string | null = null;
			// Collect all attributes for Pubhubs Card comment text
			const allDecodedAttrs: { handle: string; attr: Attr }[] = [];
			for (const [handle, attr] of Object.entries(authSuccess.attrs)) {
				if (typeof attr !== 'string') continue;
				const dec = authServer.decodeJWT(attr) as Attr;
				allDecodedAttrs.push({ handle, attr: dec });
				if (identifyingAttrs.has(handle)) {
					identifyingHandle = handle;
					signedIdentifyingAttrs[handle] = {
						signedAttr: attr,
						id: dec.attr_type,
						value: dec.value,
					};
				} else {
					signedAddAttrs.push(attr);
				}
			}

			if (!identifyingHandle) {
				throw new Error('Identifying attribute missing in authentication response.');
			}

			// 8. Enter PubHubs
			const identifyingAttr = authSuccess.attrs[identifyingHandle];
			const { entered, errorMessage } = await this.phcServer.enter(signedAddAttrs, enterMode, identifyingAttr);
			if (!entered) return errorMessage;

			// Load updated state
			await this.phcServer.stateEP();

			// Load Secret objects
			const userSecret = await this.phcServer.getUserSecretObject();
			const objectDetails = userSecret?.details ?? null;
			const userSecretObject = userSecret?.object ?? null;

			// 9. Issue card if registering
			if (enterMode === PHCEnterMode.LoginOrRegister) {
				const comment = allDecodedAttrs.map(({ handle, attr }) => `${handle}: ${attr.value}`).join('\n');
				const { cardAttr, errorMessage } = await this.issueCard(true, comment);
				if (!cardAttr) return errorMessage;
				signedIdentifyingAttrs['ph_card'] = cardAttr;
			}

			// 10. Build attribute key request
			const attrKeyReq: AuthAttrKeyReq = {};
			for (const [handle, attr] of Object.entries(signedIdentifyingAttrs)) {
				let timestamp = null;
				if (isUserSecretObjectNew(userSecretObject)) {
					timestamp = userSecretObject?.data?.[attr.id]?.[attr.value]?.ts ?? null;
				} else if (userSecretObject) {
					timestamp = userSecretObject?.[attr.id]?.[attr.value]?.ts ?? null;
				}
				attrKeyReq[handle] = { attr: attr.signedAttr, timestamp };
			}
			const attrKeyResp = await authServer.attrKeysEP(attrKeyReq);

			// Retry rules
			if ('RetryWithNewAttr' in attrKeyResp) {
				useGlobal().logout();
				return { key: 'errors.retry_with_new_attr' };
			}

			// 11. Store user secret objects
			if (ResultResponse.Success in attrKeyResp) {
				await this.phcServer.storeUserSecretObject(attrKeyResp.Success, signedIdentifyingAttrs, userSecretObject, objectDetails);
			}
		},

		logout() {
			this.phcServer.reset();
			localStorage.removeItem('PHauthToken');
			localStorage.removeItem('UserSecret');
			localStorage.removeItem('UserSecretVersion');
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
			await this.phcServer.encryptAndStoreObject<T>(handle, data, overwriteHash);
		},

		withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
			return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
		},

		async getHubInfo(hubServerUrl: string): Promise<InfoResp> {
			const infoResp = await hub_api.api<HubInfoResp | InfoResp>(`${hubServerUrl}${hub_api.apiURLS.info}`);

			// hubs <= v3.0.0 do not wrap the info response in an "Ok": { ... }
			if (isResult(infoResp)) {
				return await handleErrors<InfoResp>(() => Promise.resolve(infoResp));
			}

			return infoResp;
		},

		async enterHub(id: string, nonceStatePair: EnterStartResp) {
			const maxAttempts = 3;
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				// TODO create a delay function
				if (attempt > 0) {
					const ms = 100 * Math.pow(2, attempt - 1); // 100, 200, 400 …
					await new Promise((resolve) => setTimeout(resolve, ms));
				}
				const sealedPPP = await this.phcServer.pppEP();
				assert.isDefined(sealedPPP, 'Something went wrong, sealedPPP should be defined.');
				const transcryptor = await this.getTranscryptor();
				const sealedEhpp = await transcryptor.ehppEP(nonceStatePair.nonce, id, sealedPPP);
				if (sealedEhpp === 'RetryWithNewPpp' && attempt < maxAttempts) continue;
				else if (sealedEhpp === 'RetryWithNewPpp') throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				assert.isDefined(sealedEhpp, 'Something went wrong, sealedEhpp should be defined or you should have gone back to requesting a new Ppp.');
				const signedHhpp = await this.phcServer.hhppEP(sealedEhpp);
				if (signedHhpp === 'RetryWithNewPpp' && attempt < maxAttempts) continue;
				else if (signedHhpp === 'RetryWithNewPpp') throw new Error('Theres something wrong with the sso::EncryptedHubPseudonymPackage');
				assert.isDefined(signedHhpp, 'Something went wrong, signedHhpp should be defined or you should have logged out or gone back to requesting a new Ppp.');
				return signedHhpp;
			}
		},
	},
});

export { useMSS };
