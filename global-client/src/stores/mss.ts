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
import { EnterStartResp, InfoResp, Result, ResultResponse } from '@global-client/models/MSS/TGeneral';
import { Attr, AttrAddStatus, Constellation, HubInformation, PHCEnterMode, PHCEnterReq, isUserSecretObjectNew } from '@global-client/models/MSS/TPHC';
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

		async issueCard(comment: string = '', identifyingAttr?: string) {
			const authServer = await this.getAuthServer();

			// 1. Fetch pseudo card package from the Pubhubs Central Server
			const pseudoResp = await this.phcServer.cardPseudePackage();
			if (!(ResultResponse.Success in pseudoResp)) {
				throw new Error('Pseudo card package failed — retry with a new Authtoken.');
			}

			const cardReq: CardReq = {
				card_pseud_package: pseudoResp.Success,
				// TODO: implement string formatting
				comment: comment,
			};

			// 2. Get signed card attribute from Auth server
			const cardResp = await authServer.CardEP(cardReq);
			if (!(ResultResponse.Success in cardResp)) {
				throw new Error('Card issuance failed — retry with a new PseudoCard.');
			}

			const { attr: signedCardAttr, issuance_request } = cardResp.Success;

			// 3. Add card attribute to PubHubs Central Server
			const { entered, errorMessage } = await this.phcServer._enter([signedCardAttr], PHCEnterMode.Login, identifyingAttr);
			if (!entered) {
				return { cardAttr: null, errorMessage };
			}

			// 4. Add card to Yivi chained session
			const releaseResp = await authServer.YiviReleaseNextSessionEP({
				state: authServer.getState(),
				next_session: issuance_request,
			});
			if (!(ResultResponse.Success in releaseResp)) {
				throw new Error('Failed to add the card to the Yivi chained session.');
			}

			// 5. Decode and return card
			const decoded = authServer._decodeJWT(signedCardAttr) as Attr;

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
			const supported = await authServer._welcomeEPAuths();
			const identifyingAttrs = authServer._checkAttributes(supported, loginMethod, enterMode);

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
			const startResp = await authServer._startAuthEP(authStartReq);

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

			// Run Yivi
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
			const authSuccess = await authServer._completeAuthEP(proof, authServer.getState());

			if (!authSuccess) {
				throw new Error('Authentication completed with no data.');
			}

			// 6. Validate attributes
			const keys = Object.keys(authSuccess.attrs);
			const valid1 = authServer._responseEqualToRequested(keys, ['ph_card', 'phone']);
			const valid2 = authServer._responseEqualToRequested(keys, ['email', 'phone']);

			if (!valid1 && !valid2) {
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
				const dec = authServer._decodeJWT(attr) as Attr;
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
			const { entered, errorMessage, enterResp } = await this.phcServer._enter(signedAddAttrs, enterMode, identifyingAttr);

			if (!entered) return errorMessage;

			// Load updated state
			await this.phcServer.stateEP();

			// Secret objects
			const userSecret = await this.phcServer._getUserSecretObject();
			const objectDetails = userSecret?.details ?? null;
			const userSecretObject = userSecret?.object ?? null;

			// 9. Issue card if registering
			if (enterMode === PHCEnterMode.LoginOrRegister) {
				const comment = this.createCardComment(allDecodedAttrs);
				const { cardAttr, errorMessage } = await this.issueCard(comment);
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

			if (ResultResponse.Success in attrKeyResp) {
				await this.phcServer.storeUserSecretObject(attrKeyResp.Success, signedIdentifyingAttrs, userSecretObject, objectDetails);
			}
		},
		createCardComment(allAttrs: { handle: string; attr: Attr }[]): string {
			return allAttrs.map(({ handle, attr }) => `${handle}: ${attr.value}`).join('\n');
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
