// Packages
import { assert } from 'chai';
import { defineStore } from 'pinia';

// Logic
import { hub_api } from '@global-client/logic/core/api';
import { startYiviAuthentication } from '@global-client/logic/utils/yiviHandler';

import filters from '@hub-client/logic/core/filters';

// Models
import AuthenticationServer from '@global-client/models/MSS/Auths';
import PHCServer from '@global-client/models/MSS/PHC';
import { AuthAttrKeyReq, AuthStartReq, CardReq, LoginMethod, SignedIdentifyingAttrs, Source, SuccesResp, YiviReleaseNextSessionReq, YiviWaitForResultResp } from '@global-client/models/MSS/TAuths';
import { EnterStartResp, InfoResp, Result } from '@global-client/models/MSS/TGeneral';
import { Attr, Constellation, HubInformation, PHCEnterMode, PHCEnterReq, isUserSecretObjectNew } from '@global-client/models/MSS/TPHC';
import Transcryptor from '@global-client/models/MSS/Transcryptor';

// Stores
import { useGlobal } from '@global-client/stores/global';

import { useDialog } from '@hub-client/stores/dialog';
import { useSettings } from '@hub-client/stores/settings';

// Other
import { setLanguage, setUpi18n } from '@hub-client/i18n';

const useMSS = defineStore('mss', {
	state: () => {
		return {
			// NOTE: Do not access this._authServer directly. Use getAuthServer() instead to make sure the server is initialized with the correct API url.
			_authServer: null as AuthenticationServer | null,
			// NOTE: Do not access this._transcryptor directly. Use getTranscryptor() instead to make sure the server is initialized with the correct API url.
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

		async authenticate(loginMethod: LoginMethod, enterMode: PHCEnterMode) {
			try {
				//0. Fetch auth server
				const authServer = await this.getAuthServer();
				// 1. Fetch supported attribute types and validate
				const supportedAttrTypes = await authServer._welcomeEPAuths();
				const identifyingAttrsSet = authServer._checkAttributes(supportedAttrTypes, loginMethod, enterMode);

				let authStartReq: AuthStartReq;
				// 2. Prepare start request
				if (enterMode === PHCEnterMode.LoginOrRegister) {
					authStartReq = {
						source: loginMethod.source,
						attr_types: ['email', 'phone'],
						attr_type_choices: [],
						yivi_chained_session: true,
					};
				} else {
					authStartReq = {
						source: loginMethod.source,
						attr_types: [],
						attr_type_choices: [['ph_card', 'email'], ['phone']],
						yivi_chained_session: false,
					};
				}

				// 3. Start authentication
				const startResp = await authServer._startAuthEP(authStartReq);

				let authSuccResp: SuccesResp;

				// 4. Handle start response
				if ('Success' in startResp) {
					const { task, state } = startResp.Success;
					authServer._state = state;

					const source = loginMethod.source;
					if (source === Source.Yivi && task.Yivi) {
						const { disclosure_request, yivi_requestor_url } = task.Yivi;
						const yiviRequestorUrl = filters.removeTrailingSlash(yivi_requestor_url);

						// Perform Yivi authentication
						//
						let resultJWT: string | YiviWaitForResultResp;
						let proof: { Yivi: { disclosure: string } };
						if (enterMode === PHCEnterMode.LoginOrRegister) {
							startYiviAuthentication(yiviRequestorUrl, disclosure_request);
							resultJWT = await authServer.YiviWaitForResultEP(authServer._state);
							if ('Success' in resultJWT) {
								proof = { Yivi: resultJWT.Success };
							} else {
								throw Error('Restart authentication please');
							}
						} else {
							resultJWT = await startYiviAuthentication(yiviRequestorUrl, disclosure_request);
							console.error(typeof resultJWT);
							proof = { Yivi: { disclosure: resultJWT } };
						}

						authSuccResp = await authServer._completeAuthEP(proof, authServer._state);
					} else {
						throw new Error(`The task does not match the chosen source for the attributes: ${JSON.stringify(task)} (task), ${source} (source)`);
					}
				} else if ('UnknownAttrType' in startResp) {
					throw new Error(`No attribute type known with this handle: ${startResp.UnknownAttrType}`);
				} else if ('SourceNotAvailableFor' in startResp) {
					throw new Error(`The source (${authStartReq.source}) is not available for the attribute type: ${startResp.SourceNotAvailableFor}`);
				} else {
					throw new Error('Unknown response from the AuthStart endpoint.');
				}

				// 5. Sanity check
				if (!authSuccResp) {
					throw new Error('Authentication response was not received.');
				}

				// 6. Validate attributes
				const requestedAttrKeys = ['ph_card', 'phone'];
				const requestedAttrKeys2 = ['email', 'phone'];
				if (!authServer._responseEqualToRequested(Object.keys(authSuccResp.attrs), requestedAttrKeys) && !authServer._responseEqualToRequested(Object.keys(authSuccResp.attrs), requestedAttrKeys2)) {
					throw new Error('The disclosed attributes do not match the requested attributes.');
				}

				// 7. Collect identifying & additional attributes
				const signedAddAttrs: string[] = [];
				const signedIdentifyingAttrs: SignedIdentifyingAttrs = {};

				let selectedIdentifyingAttribute = 'test';
				for (const [handle, attr] of Object.entries(authSuccResp.attrs)) {
					if (typeof attr !== 'string') {
						console.warn(`Skipping attribute '${handle}' because value is not a string:`, attr);
						continue;
					}

					if (identifyingAttrsSet.has(handle)) {
						const decodedAttr = authServer._decodeJWT(attr) as Attr;
						selectedIdentifyingAttribute = handle;
						signedIdentifyingAttrs[handle] = {
							signedAttr: attr,
							id: decodedAttr.attr_type,
							value: decodedAttr.value,
						};
					}

					if (!loginMethod.identifying_attr.includes(handle)) {
						signedAddAttrs.push(attr);
					}
				}

				// 8. Return final result
				return {
					identifyingAttr: authSuccResp.attrs[selectedIdentifyingAttribute],
					signedIdentifyingAttrs,
					signedAddAttrs,
				};
			} catch (err) {
				console.error('Authentication failed:', err);
				throw err;
			}
		},
		async issueCard(identifyingAttr: string) {
			const authServer = await this.getAuthServer();

			// Get pseudo card package
			const cardPseudePackage = await this.phcServer.cardPseudePackage();
			// Create card requst for the Auth server
			let CardReq: CardReq;
			if ('Success' in cardPseudePackage) {
				CardReq = {
					card_pseud_package: cardPseudePackage.Success,
					comment: 'blah blah blah',
				};
			} else {
				throw new Error('Need to try again with a new Authtoken');
			}
			// Get a signed card attribute from the auth server
			const CardResp = await authServer.CardEP(CardReq);

			let enterReq: PHCEnterReq;
			let YiviReleaseNextSessionReq: YiviReleaseNextSessionReq;
			let cardAttr: string;
			if ('Success' in CardResp) {
				enterReq = {
					mode: PHCEnterMode.Login,
					add_attrs: [CardResp.Success.attr],
				};
				YiviReleaseNextSessionReq = {
					state: authServer._state,
					next_session: CardResp.Success.issuance_request,
				};
				cardAttr = CardResp.Success.attr;
			} else {
				throw new Error('Need to try again with another PseudoCard');
			}
			// return the signed card attribute to the pubhubs central server so it knows the user has a pubhubs card now.
			const { entered, errorMessage } = await this.phcServer._enter(enterReq.add_attrs, enterReq.mode, identifyingAttr);
			if (!entered) {
				throw new Error('Did not succesfully add card to central pubhubs server');
			}

			// Finally add the pubhuhs card with jwt in the chained session of yivi started in the authentication, this must be done after the attribute has been added to pubhubs central with _enter
			const releaseResp = await authServer.YiviReleaseNextSessionEP(YiviReleaseNextSessionReq);
			if (!('Success' in releaseResp)) {
				throw new Error('Did not succesfully add the card to the chained session in yivi');
			}

			const decodedAttr = authServer._decodeJWT(cardAttr) as Attr;
			return {
				signedAttr: cardAttr,
				id: decodedAttr.attr_type,
				value: decodedAttr.value,
			};
		},

		async enterPubHubs(loginMethod: LoginMethod, enterMode: PHCEnterMode) {
			const authServer = await this.getAuthServer();

			let { identifyingAttr, signedIdentifyingAttrs, signedAddAttrs } = await this.authenticate(loginMethod, enterMode);
			// const { identifyingAttr, signedIdentifyingAttrs, signedAddAttrs } = await authServer.startAuthentication(loginMethod, enterMode);
			const { entered, errorMessage, objectDetails, userSecretObject } = await this.phcServer.login(identifyingAttr, signedAddAttrs, enterMode);
			if (!entered) {
				return errorMessage;
			}
			if (enterMode === PHCEnterMode.LoginOrRegister) {
				signedIdentifyingAttrs['ph_card'] = await this.issueCard(identifyingAttr);
			}

			// Request attribute keys for all identifying attributes used to login.
			const attrKeyReq: AuthAttrKeyReq = {};
			for (const [handle, attr] of Object.entries(signedIdentifyingAttrs) as [string, (typeof signedIdentifyingAttrs)[string]][]) {
				if (isUserSecretObjectNew(userSecretObject) && attr.id in userSecretObject['data'] && userSecretObject['data'][attr.id][attr.value]) {
					attrKeyReq[handle] = { attr: attr.signedAttr, timestamp: userSecretObject['data'][attr.id][attr.value].ts };
				} else if (!isUserSecretObjectNew(userSecretObject) && userSecretObject && attr.id in userSecretObject && userSecretObject[attr.id][attr.value]) {
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

		async hasValidAuthToken() {
			try {
				const state = await this.phcServer.stateEP();
				return state !== undefined;
			} catch (error) {
				if (error instanceof Error && error.message.toLowerCase() === 'failed to fetch') {
					const dialog = useDialog();
					const i18n = setUpi18n();
					const language = useSettings().language;
					setLanguage(i18n, language);
					const { t } = i18n.global;
					dialog.confirm(t('system_offline'), t('system_offline_description'));
				} else {
					throw error;
				}
			}
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

		// TODO: possibly move this function to a utility file
		withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
			return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
		},

		async getHubInfo(hubServerUrl: string): Promise<InfoResp> {
			const infoResp = await hub_api.api<Result<InfoResp> | InfoResp>(`${hubServerUrl}${hub_api.apiURLS.info}`);

			// hubs <= v3.0.0 do not wrap the info response in an "Ok": { ... }
			if (infoResp.hasOwnProperty('Ok')) {
				return infoResp.Ok;
			}

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
