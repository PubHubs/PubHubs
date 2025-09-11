// Package imports
import { assert } from 'chai';

// Global imports
import { phc_api } from '@/logic/core/api.js';
import { useGlobal } from '@/logic/store/global.js';
import * as mssTypes from '@/model/MSS/TMultiServerSetup.js';
import { handleErrorCodes, requestOptions } from '@/model/MSS/Auths.js';
import { handleErrors } from '@/model/MSS/Auths.js';

// Hub imports
import { Api } from '@/../../../hub-client/src/logic/core/apiCore.js';

export default class PHCServer {
	private _phcAPI: Api;
	/** NOTE: Do not use this variable directly to prevent using an expired authToken. Instead, use _getAuthToken(). */
	private _authToken: string | null = null;
	private _expiryAuthToken: null | bigint = null;
	/** NOTE: Do not use this variable directly, but use _getUserSecret(). */
	private _userSecret: string | undefined;

	constructor() {
		if (!phc_api) {
			throw new Error('PHC API is null.');
		}
		this._phcAPI = phc_api;
		const savedAuthToken = localStorage.getItem('PHauthToken');
		if (savedAuthToken) {
			const authToken: mssTypes.AuthTokenPackage = JSON.parse(savedAuthToken);
			this._authToken = authToken.auth_token;
			this._expiryAuthToken = authToken.expires;
		}
	}

	// #region Global client login

	/**
	 * Contact the PHC welcome endpoint to get basic details about the current PubHubs setup.
	 *
	 * @returns Information about the PubHubs constellation and a list of hubs that are running.
	 */
	async welcome() {
		return await handleErrors<mssTypes.WelcomeRespPHC>(() => this._phcAPI.apiGET<mssTypes.PHCWelcomeResp>(this._phcAPI.apiURLS.welcome));
	}

	private _setAuthToken(authTokenPackage: mssTypes.AuthTokenPackage) {
		this._authToken = authTokenPackage.auth_token;
		this._expiryAuthToken = authTokenPackage.expires;
		localStorage.setItem('PHauthToken', JSON.stringify(authTokenPackage));
	}

	/**
	 * Handle the response from the Enter EndPoint.
	 *
	 * @param enterResp The response from the Enter EndPoint that needs to be handled.
	 */
	private _handleEnterResp(enterResp: mssTypes.EnterResp): { entered: boolean; errorMessage: { key: string; values?: Array<string> } | null } {
		if (enterResp === 'AccountDoesNotExist') {
			return { entered: false, errorMessage: { key: 'errors.account_does_not_exist' } };
		} else if (enterResp === 'Banned') {
			return { entered: false, errorMessage: { key: 'errors.banned' } };
		} else if (enterResp === 'NoBannableAttribute') {
			return { entered: false, errorMessage: { key: 'errors.general_error' } };
		} else if (enterResp === 'RetryWithNewIdentifyingAttr') {
			return { entered: false, errorMessage: { key: 'errors.retry_with_new_attr' } };
		} else if ('AttributeBanned' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.attribute_banned', values: [enterResp.AttributeBanned.value] } };
		} else if ('AttributeAlreadyTaken' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.attribute_already_taken', values: [enterResp.AttributeAlreadyTaken.value] } };
		} else if ('RetryWithNewAddAttr' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.retry_with_new_attr' } };
		} else {
			const { auth_token_package } = enterResp.Entered;
			const authToken = handleErrorCodes<mssTypes.AuthTokenPackage, mssTypes.AuthTokenDeniedReason>(auth_token_package);
			this._setAuthToken(authToken);
			return { entered: true, errorMessage: null };
		}
	}

	/**
	 * Request to enter PubHubs, depending on the enterMode registering a new account or logging into an existing account.
	 *
	 * @param identifyingAttr The attribute identifying the user when registering or logging in.
	 * @param signedAddAttrs The attributes that have to be added to the account, required when registering a new account or when no bannable attribute is registered for this account.
	 * @param enterMode The mode determines whether we want to create an account if none exists and whether we expect an account to exist.
	 * @returns An object with a boolean to know whether the user successfully entered PubHubs or not and an error message (which is null if no error occured).
	 */
	private async _enter(identifyingAttr: string, signedAddAttrs: string[], enterMode: mssTypes.PHCEnterMode) {
		const requestPayload: mssTypes.PHCEnterReq = {
			identifying_attr: identifyingAttr,
			mode: enterMode,
			add_attrs: signedAddAttrs,
		};
		const okEnterResp = await handleErrors(() => this._phcAPI.api<mssTypes.PHCEnterResp>(this._phcAPI.apiURLS.enter, requestOptions<mssTypes.PHCEnterReq>(requestPayload)));
		const { entered, errorMessage } = this._handleEnterResp(okEnterResp);
		return { entered, errorMessage };
	}

	async login(identifyingAttr: string, signedAddAttrs: string[], enterMode: mssTypes.PHCEnterMode) {
		const { entered, errorMessage } = await this._enter(identifyingAttr, signedAddAttrs, enterMode);

		if (!entered) {
			return { entered, errorMessage, objectDetails: null, userSecretObject: null };
		}
		const userSecretObject = await this.getUserObject('usersecret');

		if (!userSecretObject || !userSecretObject.object) {
			return { entered, objectDetails: null, userSecretObject: null };
		} else {
			const decoder = new TextDecoder();
			const decodedUserSecret = decoder.decode(userSecretObject.object);
			const secretObject = JSON.parse(decodedUserSecret) as mssTypes.UserSecretObject;
			return { entered, objectDetails: userSecretObject.details, userSecretObject: secretObject };
		}
	}

	private async _refreshEP() {
		assert.isNotNull(this._authToken, 'An (expired) authToken is needed to call the refreshEP.');
		const options = {
			headers: { Authorization: this._authToken },
			method: 'GET',
		};
		const okRefreshResp = await handleErrors<mssTypes.RefreshResp>(() => this._phcAPI.api<mssTypes.PHCRefreshResp>(this._phcAPI.apiURLS.refresh, options));
		if (okRefreshResp === 'ReobtainAuthToken') {
			const global = useGlobal();
			global.logout();
		} else if ('Denied' in okRefreshResp) {
			if (okRefreshResp.Denied === mssTypes.AuthTokenDeniedReason.Banned) throw new Error('The user is trying to login with a banned attribute');
			else throw new Error('The user does not have a bannable attribute');
		} else {
			return okRefreshResp.Success;
		}
	}

	private async _getAuthToken() {
		if (!this._authToken) {
			const global = useGlobal();
			global.logout();
			return;
		}
		// Convert Date.now() to represent the number of seconds from 1970-01-01T00:00:00Z UTC, to be able to compare it to the expiry timestamp we get from the AuthTokenPackage.
		const now: bigint = BigInt(Math.floor(Date.now() / 1000));
		if (this._authToken && this._expiryAuthToken && this._expiryAuthToken <= now) {
			const refreshAuthTokenPackage = await this._refreshEP();
			assert.isDefined(refreshAuthTokenPackage, 'Something went wrong, refreshAuthTokenPackage should have been defined or you should have been redirected.');
			this._setAuthToken(refreshAuthTokenPackage);
		}
		return this._authToken;
	}

	// #endregion

	// #region UserSecret object

	private async _getUserSecret() {
		const global = useGlobal();
		assert.isNotNull(global.loggedIn, 'The user secret cannot be requested if a user is not logged in.');
		if (this._userSecret) {
			return this._userSecret;
		}

		const storedUserSecret = localStorage.getItem('UserSecret');
		// This will only happen when a user is messing with their local storage, which means the logout procedure will be invoked.
		if (!storedUserSecret) {
			const global = useGlobal();
			global.logout();
			return;
		}
		this._userSecret = storedUserSecret;
		return this._userSecret;
	}

	private async _decryptUserSecret(oldAttrKey: string, userSecretObject: { ts: string; encUserSecret: string }) {
		const encUserSecret = new Uint8Array(Buffer.from(userSecretObject.encUserSecret, 'base64'));
		const userSecret = await this._decryptData(encUserSecret, oldAttrKey);
		return userSecret;
	}

	private _areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
		if (a === b) {
			return true;
		}
		if (a.length !== b.length) {
			return false;
		}
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	async computeNewUserSecretObject(attrKeyResp: Record<string, mssTypes.AttrKeyResp>, identifyingAttrs: mssTypes.SignedIdentifyingAttrs, userSecretObject: mssTypes.UserSecretObject | null) {
		let newUserSecretObject: mssTypes.UserSecretObject = userSecretObject ? { ...userSecretObject } : {};
		let userSecret: Uint8Array | null = null;
		if (userSecretObject === null) {
			// If this is the first time the user secret object is set, a random 256 bits (32 bytes) user secret needs to be generated.
			userSecret = window.crypto.getRandomValues(new Uint8Array(32));
		} else {
			let referenceUserSecret: Uint8Array | null = null;

			for (const [handle, attr] of Object.entries(identifyingAttrs)) {
				const keyResp = attrKeyResp[handle];
				// If the user secret was not stored before for this combination of attribute type and value, continue.
				if (!userSecretObject[attr.id]?.[attr.value]) {
					continue;
				}
				// If there is no old_key in the attrKeyResp for this attribute, something went wrong
				if (keyResp.old_key === null) {
					throw new Error(`Expected an old_key in the attrKeyResp for attribute with type ${attr.id} and value ${attr.value}`);
				}
				// Try to decrypt the user secret
				const decryptedUserSecret = await this._decryptUserSecret(keyResp.old_key, userSecretObject[attr.id][attr.value]);
				if (referenceUserSecret === null) {
					referenceUserSecret = decryptedUserSecret;
				} else if (!this._areUint8ArraysEqual(referenceUserSecret, decryptedUserSecret)) {
					throw new Error('Something went wrong, the user secrets for different identifying attributes do not match.');
				}
			}

			if (referenceUserSecret === null) {
				throw new Error('Could not recover the user secret.');
			}
			userSecret = referenceUserSecret;
		}

		// Encrypt the user secret with the new attribute key for each of the identifying attributes used in this enter request.
		for (const [handle, attr] of Object.entries(identifyingAttrs)) {
			const keyResp = attrKeyResp[handle];
			// Encrypt the userSecret with the new attribute key and compose the new userSecret object
			const cipherText = await this._encryptData(userSecret, keyResp.latest_key[0]);
			// Use local OR assignment operator (||=) to make sure that newUserSecretObject is initialized before assigning the nested property
			(newUserSecretObject[attr.id] ||= {})[attr.value] = { ts: keyResp.latest_key[1], encUserSecret: Buffer.from(cipherText).toString('base64') };
		}
		return { newUserSecretObject, userSecret };
	}

	async storeUserSecretObject(
		attrKeyResp: Record<string, mssTypes.AttrKeyResp>,
		identifyingAttrs: mssTypes.SignedIdentifyingAttrs,
		userSecretObject: mssTypes.UserSecretObject | null,
		userSecretObjectDetails: mssTypes.UserObjectDetails | null,
	) {
		const computedUserSecretObject = await this.computeNewUserSecretObject(attrKeyResp, identifyingAttrs, userSecretObject);
		if (!computedUserSecretObject || !computedUserSecretObject.userSecret) {
			console.error('Something went wrong, could not compute the new user secret object.');
			return;
		}
		const encodedNewUserSecretObject: Uint8Array = new TextEncoder().encode(JSON.stringify(computedUserSecretObject.newUserSecretObject));

		let response: string | undefined;
		// Store the userSecret object
		if (!userSecretObjectDetails) {
			response = await this._newObjectEP('usersecret', encodedNewUserSecretObject);
		} else {
			const overwriteHash = userSecretObjectDetails.hash;
			response = await this._overwriteObjectEP('usersecret', overwriteHash, encodedNewUserSecretObject);
		}
		if (response !== undefined) {
			// Encode the userSecret as a base64 string
			this._userSecret = this._uint8ArrayToBase64(computedUserSecretObject.userSecret);
			localStorage.setItem('UserSecret', this._userSecret);
		}
		// TODO: check with hash if object was properly stored
	}

	// #endregion

	// #region Encrypt and decrypt

	/**
	 * Concatenate the Uint8Arrays.
	 *
	 * @param arrays A list of Uint8Arrays that should be concatenated.
	 * @returns A single Uint8Array in which the arrays are concatenated.
	 */
	private _concatUint8Arrays(arrays: Uint8Array[]) {
		// Compute how long the concatenatedArray should be
		let newLength = 0;
		for (const array of arrays) {
			newLength += array.length;
		}

		// Create a new Uint8Array of the correct length and concatenate the arrays
		const concatenatedArray = new Uint8Array(newLength);

		let offset = 0;
		for (const array of arrays) {
			concatenatedArray.set(array, offset);
			offset += array.length;
		}

		return concatenatedArray;
	}

	/**
	 * Encrypt the data to store it at PubHubs Central.
	 *
	 * @param data The data that will be encrypted.
	 * @param key The key to encrypt the data.
	 * @returns The ciphertext of the encrypted data.
	 */
	private async _encryptData(data: Uint8Array, key: string) {
		// Encode the key
		const encoder = new TextEncoder();
		const encodedKey = encoder.encode(key);
		// Generate random 256 bits (32 bytes) data
		const randomBits = crypto.getRandomValues(new Uint8Array(32));
		// Append the key to the random 256 bits
		// These random bits are generated and added before the encoded key to make sure that the key used to encrypt the data is different every time.
		// We need a different key every time, because there is a limit on how many times the encrypt function can be invoked with the same key when using RBG-based IV construction,
		// as written in section 8.3 of NIST Special Publication 800-38D (https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf).
		// Having a different key every time means that there is a negligible chance of using the same key with the same iv twice.
		// The IV could have been constructed of just random bits, but this would mean that we need to store an extra 32 bytes for every object to store the IV with the encrypted data.
		const derivedKey = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('key')]);
		const derivedIV = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('iv')]);
		// Calculate the SHA-256 hash of the concatenated random bits with the key to use as AES key and IV
		const aesKeyHash = await crypto.subtle.digest('SHA-256', derivedKey);
		const iv = await crypto.subtle.digest('SHA-256', derivedIV);
		// Import the key and use it to encrypt the data
		const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
		const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
		// Prepend the random bits to the ciphertext
		const cipherText = this._concatUint8Arrays([randomBits, new Uint8Array(encryptedData)]);
		return cipherText;
	}

	/**
	 * Decrypt the data that is stored at PubHubs Central.
	 *
	 * @param ciphertext The data that will be decrypted.
	 * @param key The key to decrypt the data.
	 * @returns The plaintext of the decrypted data.
	 */
	private async _decryptData(ciphertext: Uint8Array, key: string) {
		// Encode the key
		const encoder = new TextEncoder();
		const encodedAttrKey = encoder.encode(key);
		// Extract the random bits of data (that were used to generate the seed) from the ciphertext
		const randomBits = ciphertext.slice(0, 32);
		// Recover the seed by appending the encoded attrKey to the random bits of data
		const seedKey = this._concatUint8Arrays([randomBits, encodedAttrKey, encoder.encode('key')]);
		const seedIV = this._concatUint8Arrays([randomBits, encodedAttrKey, encoder.encode('iv')]);
		// Calculate the SHA-256 hash of the concatenated random bits with the key to use as AES key and the SHA-512 hash to use as IV
		const aesKeyHash = await crypto.subtle.digest('SHA-256', seedKey);
		const iv = await crypto.subtle.digest('SHA-256', seedIV);
		// Import the key and use it to decrypt the data
		const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
		const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext.slice(32));
		return new Uint8Array(decryptedData);
	}

	// #endregion

	// #region User object store

	private _uint8ArrayToBase64(array: Uint8Array) {
		// Convert the Uint8Array into a binary string
		const binary = String.fromCharCode(...array);
		// Convert the binary string into a base64-encoded string
		const base64 = btoa(binary);
		return base64;
	}

	/**
	 * Request the state of the current user.
	 *
	 * @returns Either a message to retry with an updated token or the state of the current user.
	 */
	private async _stateEP() {
		const options = {
			headers: { Authorization: await this._getAuthToken() },
			method: 'GET',
		};
		const okStateResp = await handleErrors<mssTypes.StateResp>(() => this._phcAPI.api<mssTypes.PHCStateResp>(this._phcAPI.apiURLS.state, options));
		if (okStateResp === 'RetryWithNewAuthToken') {
			const global = useGlobal();
			await global.logout();
		} else if ('State' in okStateResp) {
			return okStateResp.State;
		} else {
			throw new Error('Unknown response from to state endpoint.');
		}
	}

	/**
	 * Retrieve a user object with a given hash from PubHubs central.
	 * Authorization happens by using the HMAC from the userObjectDetails, so the access token is not included in the headers of the request.
	 *
	 * @param objectDetails The details on the object stored at pubhubs central.
	 * @param handle The handle of the object that is requested.
	 * @returns The requested object if it exists.
	 */
	private async _getObjectEP(objectDetails: mssTypes.UserObjectDetails, handle: string) {
		const maxAttempts = 3;
		let details = objectDetails;
		for (let attempts = 0; attempts < maxAttempts; attempts++) {
			const getObjResp = await handleErrors<mssTypes.GetObjectRespProblem>(() => this._phcAPI.apiGET<mssTypes.PHCGetObjectResp | ArrayBuffer>(this._phcAPI.apiURLS.getObject + '/' + objectDetails.hash + '/' + objectDetails.hmac));
			if (getObjResp instanceof ArrayBuffer) {
				return getObjResp;
			} else if (getObjResp === mssTypes.GetObjectRespProblem.NotFound || getObjResp === mssTypes.GetObjectRespProblem.RetryWithNewHmac) {
				if (attempts === maxAttempts) {
					throw new Error(`Could not retrieve the object with handle ${handle}, errorcode: ${getObjResp}`);
				}
				// TODO: check if this is the correct way to handle both of these cases
				const objectDetails = await this._getObjectDetails(handle);
				// If the object cannot be found, return null.
				if (!objectDetails) {
					return null;
				}
				details = objectDetails;
				continue;
			} else {
				throw new Error('Unknown response from the getObject endpoint.');
			}
		}
	}

	private async _getObjectDetails(handle: string): Promise<mssTypes.UserObjectDetails | null | undefined> {
		const state = await this._stateEP();
		if (state === undefined) {
			throw new Error('Could not retrieve the state for this user.');
		}
		const objectDetails: mssTypes.UserObjectDetails | null = state.stored_objects[handle];
		return objectDetails;
	}

	/**
	 * Try to retrieve a user object from PubHubs Central.
	 *
	 * @param handle The handle of the object that needs to be retrieved.
	 * @returns The object and the corresponding object details if the object exists; null otherwise.
	 */
	async getUserObject(handle: string) {
		const objectDetails = await this._getObjectDetails(handle);
		if (!objectDetails) {
			return null;
		}
		const object = await this._getObjectEP(objectDetails, handle);
		return { object, details: objectDetails };
	}

	async getDecryptedUserObject(handle: string) {
		// Retrieve the contents of the object and the userSecret
		const getObjectResp = await this.getUserObject(handle);
		if (!getObjectResp || !getObjectResp.object) {
			return null;
		}
		const object = new Uint8Array(getObjectResp.object);
		const userSecret = await this._getUserSecret();
		// this._getUserSecret will only return undefined in case where the user gets logged out because they were messing with their local storage.
		// In practice, this means that this._getUserSecret will never return undefined, since the user will have been redirected to the login page in that case.
		assert.isDefined(userSecret);
		// Decrypt the data that was stored under the given handle
		const decryptedData = await this._decryptData(object, userSecret);

		// Decode the data
		const decoder = new TextDecoder();
		const decodedData = decoder.decode(decryptedData);
		return decodedData;
	}

	private async _newObjectEP(handle: string, object: Uint8Array): Promise<string | undefined> {
		const maxAttempts = 3;
		for (let attempts = 0; attempts < maxAttempts; attempts++) {
			const options = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					Authorization: await this._getAuthToken(),
				},
				body: object,
			};
			const newObjectResp = await handleErrors<mssTypes.StoreObjectResp>(() => this._phcAPI.api<mssTypes.PHCStoreObjectResp>(this._phcAPI.apiURLS.newObject + '/' + handle, options));
			switch (newObjectResp) {
				case 'PleaseRetry':
					if (attempts < maxAttempts) {
						continue;
					}
					throw new Error('Max attemps for RetryFromStart were passed');
				case 'RetryWithNewAuthToken':
					const global = useGlobal();
					global.logout();
					return;
				case 'MissingHash':
					// There is already an object stored under this handle, so use overwriteObjectEP instead
					const existingObject = await this.getUserObject(handle);
					if (!existingObject) {
						throw new Error('Could not find the object, even though getting a MissingHash response from newObjectEP.');
					}
					return await this._overwriteObjectEP(handle, existingObject.details.hash, object);
				case 'NotFound':
					throw new Error('Unexpected response NotFound for a newObjectEP request.');
				case 'HashDidNotMatch':
					throw new Error('Unexpected response HashDidNotMatch for a newObjectEP request.');
				case 'NoChanges':
					break;
				default:
					if ('QuotumReached' in newObjectResp) {
						throw new Error(`Could not store the new user object with handle ${handle}, because the quotum is reached.`);
					} else if ('Stored' in newObjectResp) {
						return newObjectResp.Stored.hash;
					}
					throw new Error('Unknown response for newObjectEP request.');
			}
		}
	}

	private async _overwriteObjectEP(handle: string, overwriteHash: string, object: Uint8Array): Promise<string | undefined> {
		const maxAttempts = 3;
		let hash = overwriteHash;
		for (let attempts = 0; attempts < maxAttempts; attempts++) {
			const options = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					Authorization: await this._getAuthToken(),
				},
				body: object,
			};
			const overwriteObjectResp = await handleErrors<mssTypes.StoreObjectResp>(() => this._phcAPI.api<mssTypes.PHCStoreObjectResp>(this._phcAPI.apiURLS.overwriteObject + '/' + handle + '/' + hash, options));
			switch (overwriteObjectResp) {
				case 'PleaseRetry':
					if (attempts < maxAttempts) {
						continue;
					}
					throw new Error('Max attemps for RetryFromStart were passed');
				case 'RetryWithNewAuthToken':
					const global = useGlobal();
					global.logout();
					return;
				case 'MissingHash':
					throw new Error('Unexpected response MissingHash for a newObjectEP request.');
				case 'NotFound':
					return await this._newObjectEP(handle, object);
				case 'HashDidNotMatch':
					if (attempts < maxAttempts) {
						const existingObject = await this.getUserObject(handle);
						if (existingObject !== null) {
							hash = existingObject.details.hash;
							continue;
						}
						throw new Error('Could not find the object.');
					}
				case 'NoChanges':
					break;
				default:
					if ('QuotumReached' in overwriteObjectResp) {
						throw new Error(`Could not store the new user object with handle ${handle}, because the quotum is reached.`);
					} else if ('Stored' in overwriteObjectResp) {
						return overwriteObjectResp.Stored.hash;
					}
					throw new Error('Unknown response for newObjectEP request.');
			}
		}
	}

	async storeObject<T>(handle: string, data: T, overwriteHash?: string) {
		// Encode the data
		const encoder = new TextEncoder();
		const encodedData = encoder.encode(JSON.stringify(data));
		// Encrypt the encoded data if the userSecret is present
		const userSecret = await this._getUserSecret();
		if (!userSecret) {
			throw new Error('Could not retrieve the secret needed to encrypt the data.');
		}
		const encryptedData = await this._encryptData(encodedData, userSecret);

		let storeObjectResp: string | undefined;
		if (overwriteHash) {
			storeObjectResp = await this._overwriteObjectEP(handle, overwriteHash, encryptedData);
		} else {
			storeObjectResp = await this._newObjectEP(handle, encryptedData);
		}

		// TODO: check with hash if object was properly stored
	}

	// #region Hub Login

	async pppEP() {
		const options = {
			headers: { Authorization: await this._getAuthToken() },
			method: 'POST',
		};
		const okPppResp = await handleErrors<mssTypes.PppResp>(() => this._phcAPI.api<mssTypes.PHCPppResp>(this._phcAPI.apiURLS.polymorphicPseudonymPackage, options));
		if (okPppResp === 'RetryWithNewAuthToken') {
			const global = useGlobal();
			await global.logout();
		} else {
			return okPppResp.Success;
		}
	}

	async hhppEP(sealedEhpp: string) {
		const hhppReq: mssTypes.HhppReq = { ehpp: sealedEhpp };
		const options = {
			body: JSON.stringify(hhppReq),
			headers: {
				'Content-Type': 'application/json',
				Authorization: await this._getAuthToken(),
			},
			method: 'POST',
		};
		const okHhppResp = await handleErrors<mssTypes.HhppResp>(() => this._phcAPI.api<mssTypes.PHCHhppResp>(this._phcAPI.apiURLS.HashedHubPseudonymPackage, options));
		if (okHhppResp === 'RetryWithNewPpp') {
			return okHhppResp;
		} else if (okHhppResp === 'RetryWithNewAuthToken') {
			localStorage.removeItem('PHauthToken');
		} else {
			return okHhppResp.Success;
		}
	}

	// #endregion
}
