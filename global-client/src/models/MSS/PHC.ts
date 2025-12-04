// Packages
import { AttrKeyResp, SignedIdentifyingAttrs } from './TAuths';
import { assert } from 'chai';

// Logic
import { phc_api } from '@global-client/logic/core/api';

import { Api } from '@hub-client/logic/core/apiCore';

// Models
import { ErrorCode, Result } from '@global-client/models/MSS/TGeneral';
import * as TPHC from '@global-client/models/MSS/TPHC';

// Stores
import { useGlobal } from '@global-client/stores/global';

import { DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';
import { useSettings } from '@hub-client/stores/settings';

// Other
import { setLanguage, setUpi18n } from '@hub-client/i18n';
import { base64fromBase64Url, handleErrorCodes, handleErrors, requestOptions } from '@global-client/logic/utils/mssUtils';

export default class PHCServer {
	private readonly _phcAPI: Api;
	private _userStateObjects: Record<string, TPHC.UserObjectDetails> | undefined;
	/** NOTE: Do not use this variable directly to prevent using an expired authToken. Instead, use _getAuthToken(). */
	private _authToken: string | null = null;
	private _expiryAuthToken: null | bigint = null;
	/** NOTE: Do not use this variable directly, but use _getUserSecretInfo(). */
	private _userSecret: string | undefined;
	/** NOTE: Do not use this variable directly, but use _getUserSecretInfo(). */
	private _userSecretVersion: number | undefined;

	constructor() {
		if (!phc_api) {
			throw new Error('PHC API is null.');
		}
		this._phcAPI = phc_api;
		const savedAuthToken = localStorage.getItem('PHauthToken');
		if (savedAuthToken) {
			const authToken: TPHC.AuthTokenPackage = JSON.parse(savedAuthToken);
			this._authToken = authToken.auth_token;
			this._expiryAuthToken = authToken.expires;
		}
	}

	reset() {
		this._userStateObjects = undefined;
		const savedAuthToken = localStorage.getItem('PHauthToken');
		if (savedAuthToken) {
			const authToken: TPHC.AuthTokenPackage = JSON.parse(savedAuthToken);
			this._authToken = authToken.auth_token;
			this._expiryAuthToken = authToken.expires;
		} else {
			this._authToken = null;
			this._expiryAuthToken = null;
		}
	}

	triggerLogoutProcedure() {
		const dialog = useDialog();
		const global = useGlobal();
		const i18n = setUpi18n();
		const language = useSettings().language;
		setLanguage(i18n, language);
		const { t } = i18n.global;
		dialog.confirm(t('login.not_logged_in'), t('login.login_again'));
		dialog.addCallback(DialogOk, async () => {
			await global.logout();
			dialog.removeCallback(DialogOk);
			dialog.removeCallback(DialogCancel);
		});
		dialog.addCallback(DialogCancel, async () => {
			await global.logout();
			dialog.removeCallback(DialogCancel);
			dialog.removeCallback(DialogOk);
		});
	}

	// #region Global client login

	/**
	 * Contact the PHC welcome endpoint to get basic details about the current PubHubs setup.
	 *
	 * @returns Information about the PubHubs constellation and a list of hubs that are running.
	 */
	async welcome() {
		return await handleErrors<TPHC.WelcomeRespPHC>(() => this._phcAPI.apiGET<TPHC.PHCWelcomeResp>(this._phcAPI.apiURLS.welcome));
	}
	async cardPseudePackage(): Promise<TPHC.CardPseudResp> {
		const options = {
			headers: {
				'Content-Type': 'application/json',
				Authorization: await this._getAuthToken(),
			},
			method: 'POST',
		};
		const CardPsFn = () => this._phcAPI.api<Result<TPHC.CardPseudResp, ErrorCode>>(this._phcAPI.apiURLS.CardPseudPackage, options);
		return await handleErrors<TPHC.CardPseudResp>(CardPsFn);
	}

	private _setAuthToken(authTokenPackage: TPHC.AuthTokenPackage) {
		this._authToken = authTokenPackage.auth_token;
		this._expiryAuthToken = authTokenPackage.expires;
		localStorage.setItem('PHauthToken', JSON.stringify(authTokenPackage));
	}

	/**
	 * Handle the response from the EnterEP.
	 *
	 * @param enterResp The response from the EnterEP that needs to be handled.
	 * @returns An object with a boolean denoting whether the user successfully entered PubHubs and an errorMessage.
	 * The errorMessage is null if the user successfully entered, an object with a translation key and a list of values to use in the translation otherwise.
	 */
	private _handleEnterResp(enterResp: TPHC.EnterResp): { entered: false; errorMessage: { key: string; values?: string[] }; enterResp: null } | { entered: true; errorMessage: null; enterResp: [TPHC.Attr, TPHC.AttrAddStatus][] } {
		if (enterResp === 'AccountDoesNotExist') {
			return { entered: false, errorMessage: { key: 'errors.account_does_not_exist' }, enterResp: null };
		} else if (enterResp === 'Banned') {
			return { entered: false, errorMessage: { key: 'errors.banned' }, enterResp: null };
		} else if (enterResp === 'NoBannableAttribute') {
			return { entered: false, errorMessage: { key: 'errors.general_error' }, enterResp: null };
		} else if (enterResp === 'RetryWithNewIdentifyingAttr') {
			return { entered: false, errorMessage: { key: 'errors.retry_with_new_attr' }, enterResp: null };
		} else if ('AttributeBanned' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.attribute_banned', values: [enterResp.AttributeBanned.value] }, enterResp: null };
		} else if ('AttributeAlreadyTaken' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.attribute_already_taken', values: [enterResp.AttributeAlreadyTaken.value] }, enterResp: null };
		} else if ('RetryWithNewAddAttr' in enterResp) {
			return { entered: false, errorMessage: { key: 'errors.retry_with_new_attr' }, enterResp: null };
		} else if ('Entered' in enterResp) {
			const { auth_token_package } = enterResp.Entered;
			const authToken = handleErrorCodes<TPHC.AuthTokenPackage, TPHC.AuthTokenDeniedReason>(auth_token_package);
			this._setAuthToken(authToken);
			return { entered: true, errorMessage: null, enterResp: enterResp.Entered.attr_status };
		} else {
			throw new Error('Unknown response from the enter endpoint.');
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
	public async enter(
		signedAddAttrs: string[],
		enterMode: TPHC.PHCEnterMode,
		identifyingAttr?: string,
	): Promise<{ entered: true; errorMessage: null; enterResp: [TPHC.Attr, TPHC.AttrAddStatus][] } | { entered: false; errorMessage: { key: string; values?: string[] }; enterResp: null }> {
		const requestPayload: TPHC.PHCEnterReq = {
			identifying_attr: identifyingAttr,
			mode: enterMode,
			add_attrs: signedAddAttrs,
		};
		let authorization: string | undefined;
		if (!identifyingAttr) authorization = await this._getAuthToken();
		const okEnterResp = await handleErrors(() => this._phcAPI.api<TPHC.PHCEnterResp>(this._phcAPI.apiURLS.enter, requestOptions<TPHC.PHCEnterReq>(requestPayload, authorization)));
		return this._handleEnterResp(okEnterResp);
	}

	/**
	 * Check if two objects (A and B) are equal.
	 *
	 * @param a Object A
	 * @param b Object B
	 * @returns true if the objects are equal, false otherwise.
	 */
	private _deepEqualObjects(a: any, b: any): boolean {
		if (a === b) return true;
		if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		if (keysA.length !== keysB.length) return false;

		for (const key of keysA) {
			if (!keysB.includes(key)) return false;
			if (!this._deepEqualObjects(a[key], b[key])) return false;
		}
		return true;
	}

	/**
	 * Request the user secret object from the object store. Make sure that, if there is a backup stored, both user secret objects are equal.
	 *
	 * @returns An object with the decoded user secret and its details if the object exists; null otherwise.
	 * @throws Will throw an error if there is no backup user secret object stored while this is expected.
	 * @throws Will throw an error if the backup user secret object differs from the user secret object.
	 */
	public async getUserSecretObject(): Promise<{ object: TPHC.UserSecretObject; details: { usersecret: TPHC.UserObjectDetails; backup: TPHC.UserObjectDetails | null } } | null> {
		const userSecretObject = await this.getUserObject('usersecret');

		if (!userSecretObject?.object) {
			return null;
		}
		const decoder = new TextDecoder();
		const decodedUserSecret = decoder.decode(userSecretObject.object);
		const object = JSON.parse(decodedUserSecret) as TPHC.UserSecretObject;
		// If the user secret object is stored in the new format, expect there to be a backup object stored.
		if (TPHC.isUserSecretObjectNew(object)) {
			const userSecretObjectBackup = await this.getUserObject('usersecretbackup');
			if (!userSecretObjectBackup?.object) {
				this.triggerLogoutProcedure();
				throw new Error('Expected a backup of the user secret object to be stored, but could not find it.');
			}
			const decodedUserSecretBackup = decoder.decode(userSecretObjectBackup.object);
			const secretObjectBackup = JSON.parse(decodedUserSecretBackup) as TPHC.UserSecretObject;
			assert.isTrue(this._deepEqualObjects(object, secretObjectBackup), 'The user secret object differs from the backup user secret object.');
			return { object, details: { usersecret: userSecretObject.details, backup: userSecretObjectBackup.details } };
		}
		return { object, details: { usersecret: userSecretObject.details, backup: null } };
	}

	/**
	 * Call the refreshEP to refresh an (expired) authToken.
	 *
	 * @throws Will throw an error if the request to refresh the authToken was denied (for example because the user is logging in with a banned attribute).
	 */
	async refreshEP() {
		assert.isNotNull(this._authToken, 'An (expired) authToken is needed to call the refreshEP.');
		const options = {
			headers: { Authorization: this._authToken },
			method: 'GET',
		};
		const okRefreshResp = await handleErrors<TPHC.RefreshResp>(() => this._phcAPI.api<TPHC.PHCRefreshResp>(this._phcAPI.apiURLS.refresh, options));
		if (okRefreshResp === 'ReobtainAuthToken') {
			this.triggerLogoutProcedure();
		} else if ('Denied' in okRefreshResp) {
			switch (okRefreshResp.Denied) {
				case TPHC.AuthTokenDeniedReason.Banned:
					throw new Error('The user is trying to login with a banned attribute.');
				case TPHC.AuthTokenDeniedReason.NoBannableAttribute:
					throw new Error('The user does not have a bannable attribute.');
				default:
					throw new Error('Unknown reason to deny an auth token.');
			}
		} else if ('Success' in okRefreshResp) {
			this._setAuthToken(okRefreshResp.Success);
		} else {
			throw new Error('Unknown response from the refresh endpoint.');
		}
	}

	private async _getAuthToken(): Promise<string | undefined> {
		if (!this._authToken) {
			this.triggerLogoutProcedure();
			return;
		}
		// Convert Date.now() to represent the number of seconds from 1970-01-01T00:00:00Z UTC, to be able to compare it to the expiry timestamp we get from the AuthTokenPackage.
		const now: bigint = BigInt(Math.floor(Date.now() / 1000));
		if (this._authToken && this._expiryAuthToken && this._expiryAuthToken <= now) {
			await this.refreshEP();
		}
		return this._authToken;
	}

	// #endregion

	// #region UserSecret object

	private async _getUserSecretInfo() {
		const global = useGlobal();
		assert.isNotNull(global.loggedIn, 'The user secret cannot be requested if a user is not logged in.');
		if (this._userSecret && this._userSecretVersion) {
			return { userSecret: this._userSecret, version: this._userSecretVersion };
		}
		const storedUserSecret = localStorage.getItem('UserSecret');
		const version = localStorage.getItem('UserSecretVersion');
		// This will only happen when a user is messing with their local storage, which means the logout procedure will be invoked.
		if (!storedUserSecret || !version) {
			this.triggerLogoutProcedure();
			return;
		}
		this._userSecret = storedUserSecret;
		this._userSecretVersion = Number(version);
		return { userSecret: this._userSecret, version: this._userSecretVersion };
	}

	private async _decryptUserSecret(oldAttrKey: string, userSecretObject: { ts: string; encUserSecret: string }, version: number) {
		const encUserSecret = new Uint8Array(Buffer.from(userSecretObject.encUserSecret, 'base64'));
		const userSecret = await this._decryptData(encUserSecret, oldAttrKey);
		return userSecret;
	}

	private _buffersAreEqual(a: ArrayBuffer | Uint8Array | null, b: ArrayBuffer | Uint8Array | null): boolean {
		// If they are the exact same ref or are both null
		if (a === b) {
			return true;
		}

		if (a === null || b === null) {
			return false;
		}

		// Normalize inputs to Uint8Array for comparison
		const normalizedA = a instanceof Uint8Array ? a : new Uint8Array(a);
		const normalizedB = b instanceof Uint8Array ? b : new Uint8Array(b);

		if (normalizedA.byteLength !== normalizedB.byteLength) {
			return false;
		}

		for (let i = 0; i < normalizedA.length; i++) {
			if (normalizedA[i] !== normalizedB[i]) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Generates a new user secret or decrypt the existing user secret.
	 * Then encrypts the user secret with the new attribute key for each identifying attribute that was disclosed in the enter request.
	 *
	 * @param attrKeyResp The response from the attrKeysEP with the requested attribute keys.
	 * @param identifyingAttrs A list of the signed identifying attributes that were disclosed in the enter request.
	 * @param userSecretObject The data for the existing user secret object.
	 * @returns The updated user secret object.
	 * @throws Will throw an error if an old attribute key is missing in the attrKeyResp.
	 * @throws Will throw an error if the user secrets encrypted with different attribute keys do not match.
	 * @throws Will throw an error if the user secret could not successfully be decrypted.
	 */
	private async _computeNewUserSecretObject(
		attrKeyResp: Record<string, AttrKeyResp>,
		identifyingAttrs: SignedIdentifyingAttrs,
		userSecretObject: TPHC.UserSecretObject | null,
	): Promise<{ newUserSecretObject: TPHC.UserSecretObjectNew; userSecret: Uint8Array }> {
		let newUserSecretData: TPHC.UserSecretData = {};
		if (TPHC.isUserSecretObjectNew(userSecretObject)) {
			newUserSecretData = { ...userSecretObject.data };
		} else if (userSecretObject) {
			newUserSecretData = { ...userSecretObject };
		}
		let userSecret: Uint8Array | null = null;
		if (userSecretObject === null) {
			// If this is the first time the user secret object is set, a random 256 bits (32 bytes) user secret needs to be generated.
			userSecret = globalThis.crypto.getRandomValues(new Uint8Array(32));
		} else {
			let referenceUserSecret: Uint8Array | null = null;

			for (const [handle, attr] of Object.entries(identifyingAttrs)) {
				const keyResp = attrKeyResp[handle];
				// If the user secret was not stored before for this combination of attribute type and value, continue.
				if (!newUserSecretData[attr.id]?.[attr.value]) {
					continue;
				}
				// If there is no old_key in the attrKeyResp for this attribute, something went wrong
				if (keyResp.old_key === null) {
					throw new Error(`Expected an old_key in the attrKeyResp for attribute with type ${attr.id} and value ${attr.value}`);
				}
				// Try to decrypt the user secret
				const version = TPHC.isUserSecretObjectNew(userSecretObject) ? userSecretObject.version : 0;
				const decryptedUserSecret = await this._decryptUserSecret(keyResp.old_key, newUserSecretData[attr.id][attr.value], version);
				if (referenceUserSecret === null) {
					referenceUserSecret = decryptedUserSecret;
				} else if (!this._buffersAreEqual(referenceUserSecret, decryptedUserSecret)) {
					this.triggerLogoutProcedure();
					throw new Error('Something went wrong, the user secrets for different identifying attributes do not match.');
				}
			}

			if (referenceUserSecret === null) {
				this.triggerLogoutProcedure();
				throw new Error('Could not recover the user secret.');
			}
			userSecret = referenceUserSecret;
		}

		// Encrypt the user secret with the new attribute key for each of the identifying attributes used in this enter request.
		for (const [handle, attr] of Object.entries(identifyingAttrs)) {
			const keyResp = attrKeyResp[handle];
			// Encrypt the userSecret with the new attribute key and compose the new userSecret object
			const encodedKey = new Uint8Array(Buffer.from(base64fromBase64Url(keyResp.latest_key[0]), 'base64'));
			const cipherText = await this._encryptData(userSecret, encodedKey);
			// Use local OR assignment operator (||=) to make sure that newUserSecretObject is initialized before assigning the nested property
			(newUserSecretData[attr.id] ||= {})[attr.value] = { ts: keyResp.latest_key[1], encUserSecret: Buffer.from(cipherText).toString('base64') };
		}
		const newUserSecretObject: TPHC.UserSecretObject = {
			version: 1,
			data: newUserSecretData,
		};
		return { newUserSecretObject, userSecret };
	}

	/**
	 * Stores the user secret object at the PHC object store under the handles 'usersecret' and 'usersecretbackup'.
	 *
	 * @param attrKeyResp The response from the attrKeysEP with the requested attribute keys.
	 * @param identifyingAttrs A list of the signed identifying attributes that were disclosed in the enter request.
	 * @param userSecretObject The data for the existing user secret object.
	 * @param userSecretObjectDetails The object details for the existing user secret object.
	 * @throws Will throw an error if an old attribute key is missing in the attrKeyResp.
	 */
	async storeUserSecretObject(
		attrKeyResp: Record<string, AttrKeyResp>,
		identifyingAttrs: SignedIdentifyingAttrs,
		userSecretObject: TPHC.UserSecretObject | null,
		userSecretObjectDetails: { usersecret: TPHC.UserObjectDetails; backup: TPHC.UserObjectDetails | null } | null,
	): Promise<void> {
		try {
			const computedUserSecretObject = await this._computeNewUserSecretObject(attrKeyResp, identifyingAttrs, userSecretObject);
			const encodedNewUserSecretObject: Uint8Array = new TextEncoder().encode(JSON.stringify(computedUserSecretObject.newUserSecretObject));

			// Store the userSecret object (twice)
			const overwriteHash = userSecretObjectDetails ? userSecretObjectDetails.usersecret.hash : undefined;
			const storedUserSecret = await this._storeObject('usersecret', encodedNewUserSecretObject, overwriteHash);
			const overwriteHashBackup = userSecretObjectDetails?.backup ? userSecretObjectDetails.backup.hash : undefined;
			const storedBackup = await this._storeObject('usersecretbackup', encodedNewUserSecretObject, overwriteHashBackup);

			// Only set the _userSecret variable and store the user secret in localStorage if they were successfully written to the object store.
			if (storedUserSecret && storedBackup) {
				// Encode the userSecret as a base64 string
				this._userSecret = Buffer.from(computedUserSecretObject.userSecret).toString('base64');
				this._userSecretVersion = TPHC.isUserSecretObjectNew(computedUserSecretObject.newUserSecretObject) ? computedUserSecretObject.newUserSecretObject.version : 0;
				localStorage.setItem('UserSecret', this._userSecret);
				localStorage.setItem('UserSecretVersion', this._userSecretVersion.toString());
			} else {
				this.triggerLogoutProcedure();
				throw new Error('Something went wrong in storing the user secret.');
			}
		} catch (error) {
			// If anything goes wrong when storing the user secret, the user should be logged out and instructed to contact the developers.
			this.triggerLogoutProcedure();
			throw error;
		}
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
	private async _encryptData(data: Uint8Array, key: Uint8Array) {
		const encoder = new TextEncoder();
		// Generate random 256 bits (32 bytes) data
		const randomBits = crypto.getRandomValues(new Uint8Array(32));
		// Append the key to the random 256 bits
		// These random bits are generated and added before the encoded key to make sure that the key used to encrypt the data is different every time.
		// We need a different key every time, because there is a limit on how many times the encrypt function can be invoked with the same key when using RBG-based IV construction,
		// as written in section 8.3 of NIST Special Publication 800-38D (https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf).
		// Having a different key every time means that there is a negligible chance of using the same key with the same iv twice.
		// The IV could have been constructed of just random bits, but this would mean that we need to store an extra 32 bytes for every object to store the IV with the encrypted data.
		const derivedKey = this._concatUint8Arrays([randomBits, key, encoder.encode('key')]);
		const derivedIV = this._concatUint8Arrays([randomBits, key, encoder.encode('iv')]);
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
		// Extract the random bits of data (that were used to generate the seed) from the ciphertext
		const randomBits = ciphertext.slice(0, 32);
		// Recover the seed by appending the encoded attrKey to the random bits of data
		try {
			const encodedKey = new Uint8Array(Buffer.from(key, 'base64'));
			const seedKey = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('key')]);
			const seedIV = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('iv')]);
			// Calculate the SHA-256 hash of the concatenated random bits with the key to use as AES key and the SHA-512 hash to use as IV
			const aesKeyHash = await crypto.subtle.digest('SHA-256', seedKey);
			const iv = await crypto.subtle.digest('SHA-256', seedIV);
			// Import the key and use it to decrypt the data
			const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
			const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext.slice(32));
			return new Uint8Array(decryptedData);
		} catch (error) {
			console.error('Could not decrypt data with the most recent encoding version', error);
			const encodedKey = new TextEncoder().encode(key);
			const seedKey = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('key')]);
			const seedIV = this._concatUint8Arrays([randomBits, encodedKey, encoder.encode('iv')]);
			// Calculate the SHA-256 hash of the concatenated random bits with the key to use as AES key and the SHA-512 hash to use as IV
			const aesKeyHash = await crypto.subtle.digest('SHA-256', seedKey);
			const iv = await crypto.subtle.digest('SHA-256', seedIV);
			// Import the key and use it to decrypt the data
			const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
			const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext.slice(32));
			return new Uint8Array(decryptedData);
		}
	}

	// #endregion

	// #region User object store

	/**
	 * Request the state of the current user.
	 *
	 * @returns Either a message to retry with an updated token or the state of the current user.
	 */
	public async stateEP() {
		const options = {
			headers: { Authorization: await this._getAuthToken() },
			method: 'GET',
		};
		const okStateResp = await handleErrors<TPHC.StateResp>(() => this._phcAPI.api<TPHC.PHCStateResp>(this._phcAPI.apiURLS.state, options));
		if (okStateResp === 'RetryWithNewAuthToken') {
			this.triggerLogoutProcedure();
		} else if ('State' in okStateResp) {
			this._userStateObjects = okStateResp.State.stored_objects;
			return okStateResp.State;
		} else {
			throw new Error('Unknown response from the state endpoint.');
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
	private async _getObjectEP(objectDetails: TPHC.UserObjectDetails, handle: string): Promise<ArrayBuffer | null> {
		const maxAttempts = 3;
		let details = objectDetails;
		for (let attempts = 0; attempts < maxAttempts; attempts++) {
			const getObjResp = await handleErrors<TPHC.GetObjectRespProblem>(() => this._phcAPI.apiGET<TPHC.PHCGetObjectResp | ArrayBuffer>(this._phcAPI.apiURLS.getObject + '/' + details.hash + '/' + details.hmac));
			if (getObjResp instanceof ArrayBuffer) {
				return getObjResp;
			} else if (getObjResp === TPHC.GetObjectRespProblem.NotFound || getObjResp === TPHC.GetObjectRespProblem.RetryWithNewHmac) {
				if (attempts === maxAttempts) {
					throw new Error(`Could not retrieve the object with handle ${handle}, errorcode: ${getObjResp}`);
				}
				await this.stateEP();
				// TODO: check if this is the correct way to handle both of these cases
				const objectDetails = await this._getObjectDetails(handle);
				// If the object cannot be found, return null.
				if (!objectDetails) {
					return null;
				}
				details = objectDetails;
				continue;
			} else {
				throw new Error('Unknown response from the getObjectEP.');
			}
		}
		throw new Error('Unexpectedly could not handle the response of the getObjectEP.');
	}

	private async _getObjectDetails(handle: string): Promise<TPHC.UserObjectDetails | undefined> {
		if (this._userStateObjects === undefined) {
			await this.stateEP();
		}

		assert.isDefined(this._userStateObjects, 'Could not retrieve the user state.');
		const objectDetails: TPHC.UserObjectDetails | undefined = this._userStateObjects[handle];
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
		if (!getObjectResp?.object) {
			return null;
		}
		const object = new Uint8Array(getObjectResp.object);
		const userSecretInfo = await this._getUserSecretInfo();
		// this._getUserSecret will only return undefined in case where the user gets logged out because they were messing with their local storage.
		// In practice, this means that this._getUserSecret will never return undefined, since the user will have been redirected to the login page in that case.
		assert.isDefined(userSecretInfo, 'Could not retrieve the userSecret from localstorage.');
		// Decrypt the data that was stored under the given handle
		const decryptedData = await this._decryptData(object, userSecretInfo.userSecret);

		// Decode the data
		const decoder = new TextDecoder();
		const decodedData = decoder.decode(decryptedData);
		return decodedData;
	}

	/**
	 * Write a new object with a handle to the object store.
	 *
	 * @param handle The handle to store the object under.
	 * @param object The object to write to the object store.
	 * @returns True if the object was stored correctly.
	 */
	private async _newObjectEP(handle: string, object: Uint8Array): Promise<boolean | undefined> {
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
			const newObjectResp = await handleErrors<TPHC.StoreObjectResp>(() => this._phcAPI.api<TPHC.PHCStoreObjectResp>(this._phcAPI.apiURLS.newObject + '/' + handle, options));
			switch (newObjectResp) {
				case 'PleaseRetry':
					if (attempts === maxAttempts) {
						throw new Error('Max attemps for RetryFromStart were passed.');
					}
					continue;
				case 'RetryWithNewAuthToken':
					this.triggerLogoutProcedure();
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
					throw new Error('Unexpected response NoChanges for a newObjectEP request.');
				default:
					if ('QuotumReached' in newObjectResp) {
						throw new Error(`Could not store the new user object with handle ${handle}, because the quotum is reached.`);
					} else if ('Stored' in newObjectResp) {
						assert.isDefined(this._userStateObjects, 'this._userStateObjects cannot be undefined, unless something went wrong with the call to the stateEP.');
						this._userStateObjects = newObjectResp.Stored.stored_objects;
						return true;
					} else {
						throw new Error('Unknown response for newObjectEP request.');
					}
			}
		}
		throw new Error('Unexpectedly could not handle the response of the newObjectEP.');
	}

	/**
	 * Overwrite an object with a certain hash in the object store.
	 * @param handle The handle of the object to overwrite.
	 * @param overwriteHash The hash of the object to overwrite.
	 * @param object The new contents of the object.
	 * @returns True if the object was stored correctly.
	 */
	private async _overwriteObjectEP(handle: string, overwriteHash: string, object: Uint8Array): Promise<boolean | undefined> {
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
			const overwriteObjectResp = await handleErrors<TPHC.StoreObjectResp>(() => this._phcAPI.api<TPHC.PHCStoreObjectResp>(this._phcAPI.apiURLS.overwriteObject + '/' + handle + '/' + hash, options));
			switch (overwriteObjectResp) {
				case 'PleaseRetry':
					if (attempts === maxAttempts) {
						throw new Error('Max attemps for RetryFromStart were passed');
					}
					continue;
				case 'RetryWithNewAuthToken':
					this.triggerLogoutProcedure();
					return;
				case 'MissingHash':
					throw new Error('Unexpected response MissingHash for a newObjectEP request.');
				case 'NotFound':
					return await this._newObjectEP(handle, object);
				case 'HashDidNotMatch': {
					if (attempts === maxAttempts) {
						throw new Error('The object stored at this handle has a different hash');
					}
					await this.stateEP();
					const existingObject = await this.getUserObject(handle);
					if (existingObject !== null) {
						hash = existingObject.details.hash;
						continue;
					}
					throw new Error('Could not find the object.');
				}
				case 'NoChanges':
					return true;
				default:
					if ('QuotumReached' in overwriteObjectResp) {
						throw new Error(`Could not store the new user object with handle ${handle}, because the quotum is reached.`);
					} else if ('Stored' in overwriteObjectResp) {
						assert.isDefined(this._userStateObjects, 'this._userStateObjects cannot be undefined, unless something went wrong with the call to the stateEP.');
						this._userStateObjects = overwriteObjectResp.Stored.stored_objects;
						return true;
					} else {
						throw new Error('Unknown response for newObjectEP request.');
					}
			}
		}
		throw new Error('Unexpectedly could not handle the response of the overwriteEP.');
	}

	/**
	 * Stores an object at the PHC object store.
	 *
	 * @param handle The handle of the object to store.
	 * @param data The data of the object to store.
	 * @param overwriteHash The hash of the object if it existed before.
	 * @returns A boolean value, denoting whether the object was stored correctly or not.
	 */
	private async _storeObject(handle: string, data: Uint8Array, overwriteHash?: string): Promise<boolean> {
		let stored: boolean | undefined;
		if (overwriteHash) {
			stored = await this._overwriteObjectEP(handle, overwriteHash, data);
		} else {
			stored = await this._newObjectEP(handle, data);
		}

		if (!stored || stored === undefined) {
			return false;
		}
		const storedObject = await this.getUserObject(handle);
		assert.isNotNull(storedObject, `Could not retrieve the object with handle ${handle}, even though it seemed to be stored correctly.`);
		assert.isNotNull(storedObject.object, `Could not retrieve the object with handle ${handle}, even though it seemed to be stored correctly and the object details were retrieved.`);
		assert.isTrue(this._buffersAreEqual(storedObject.object, data), `The data for the object with handle ${handle} was not correctly stored.`);
		return true;
	}

	async encryptAndStoreObject<T>(handle: string, data: T, overwriteHash?: string) {
		// Encode the data
		const encoder = new TextEncoder();
		const encodedData = encoder.encode(JSON.stringify(data));
		// Encrypt the encoded data if the userSecret is present
		const userSecretInfo = await this._getUserSecretInfo();
		// this._getUserSecret will only return undefined in case where the user gets logged out because they were messing with their local storage.
		// In practice, this means that this._getUserSecret will never return undefined, since the user will have been redirected to the login page in that case.
		assert.isDefined(userSecretInfo, 'Could not retrieve the userSecret from localstorage.');
		const encodedUserSecret = new Uint8Array(Buffer.from(userSecretInfo.userSecret, 'base64'));
		const encryptedData = await this._encryptData(encodedData, encodedUserSecret);
		await this._storeObject(handle, encryptedData, overwriteHash);
	}

	// #region Hub Login

	async pppEP() {
		const options = {
			headers: { Authorization: await this._getAuthToken() },
			method: 'POST',
		};
		const okPppResp = await handleErrors<TPHC.PppResp>(() => this._phcAPI.api<TPHC.PHCPppResp>(this._phcAPI.apiURLS.polymorphicPseudonymPackage, options));
		if (okPppResp === 'RetryWithNewAuthToken') {
			this.triggerLogoutProcedure();
		} else if ('Success' in okPppResp) {
			return okPppResp.Success;
		} else {
			throw new Error('Unknown response from the ppp endpoint.');
		}
	}

	async hhppEP(sealedEhpp: string) {
		const hhppReq: TPHC.HhppReq = { ehpp: sealedEhpp };
		const options = {
			body: JSON.stringify(hhppReq),
			headers: {
				'Content-Type': 'application/json',
				Authorization: await this._getAuthToken(),
			},
			method: 'POST',
		};
		const okHhppResp = await handleErrors<TPHC.HhppResp>(() => this._phcAPI.api<TPHC.PHCHhppResp>(this._phcAPI.apiURLS.hashedHubPseudonymPackage, options));
		if (okHhppResp === 'RetryWithNewPpp') {
			return okHhppResp;
		} else if (okHhppResp === 'RetryWithNewAuthToken') {
			this.triggerLogoutProcedure();
			return;
		} else if ('Success' in okHhppResp) {
			return okHhppResp.Success;
		} else {
			throw new Error('Unknown response from the hhpp endpoint.');
		}
	}

	// #endregion
}
