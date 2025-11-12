// Packages
import { assert } from 'chai';

// Logic
import { auths_api } from '@global-client/logic/core/api';
import { startYiviAuthentication } from '@global-client/logic/utils/yiviHandler';

import { Api } from '@hub-client/logic/core/apiCore';
import filters from '@hub-client/logic/core/filters';

// Models
import * as mssTypes from '@global-client/models/MSS/TMultiServerSetup';

export default class AuthenticationServer {
	public _state: number[];
	private _authsApi: Api;

	constructor(authServerUrl: string) {
		this._state = [];
		this._authsApi = auths_api(authServerUrl);
	}

	/**
	 * Check whether the attributes that will be used for registration/login are in the list of supported attribute types
	 * and if they contain at least one identifying and at least one bannable attribute.
	 *
	 * @param supportedAttrTypes The list of attributes supported by PubHubs.
	 * @param loginMethod The login method that is currently used.
	 * @returns A set of the handles used in the login method that are identifying and thus can be used to login.
	 */
	public _checkAttributes(supportedAttrTypes: Record<string, mssTypes.AttrType>, loginMethod: mssTypes.LoginMethod, enterMode: mssTypes.PHCEnterMode) {
		if (!loginMethod.attr_types.includes(loginMethod.identifying_attr[0]) || !loginMethod.attr_types.includes(loginMethod.identifying_attr[1])) {
			throw new Error(`The identifying attribute "${loginMethod.identifying_attr}" is not included in the attribute list.`);
		}

		// Build a map from all handles (current handle + old handles) to the attributes for efficient lookup
		const handleToAttrMap = new Map<string, mssTypes.AttrType>();

		for (const [handle, attr] of Object.entries(supportedAttrTypes)) {
			handleToAttrMap.set(handle, attr); // active handle mapping
			attr.handles.forEach((oldHandle) => {
				handleToAttrMap.set(oldHandle, attr);
			});
		}

		const identifyingAttrsSet = new Set<string>();
		let hasIdentifying = false;
		// To login no bannable attribute is needed (apart from when there is not yet a bannable attribute registered, but then the enterEP will throw an error).
		let hasBannable = enterMode === mssTypes.PHCEnterMode.Login ? true : false;

		for (const attr of loginMethod.attr_types) {
			const type: mssTypes.AttrType | undefined = handleToAttrMap.get(attr);

			if (!type) {
				throw new Error(`The attribute "${attr}" is not in the list of supported attributes.`);
			}

			if (attr in loginMethod.identifying_attr && !type.identifying) {
				throw new Error(`The attribute that is to be used as an identifying attribute (${attr}) is not an identifying attribute.`);
			}

			if (type.identifying) {
				hasIdentifying = true;
				identifyingAttrsSet.add(attr);
			}
			if (type.bannable) {
				hasBannable = true;
			}
		}

		if (!hasIdentifying || !hasBannable) {
			const missing = [];

			if (!hasIdentifying) missing.push('an identifying attribute');
			if (!hasBannable) missing.push('a bannable attribute');

			throw new Error(`Invalid attribute list: Missing ${missing.join(' and ')} required for registration/login.`);
		}

		return identifyingAttrsSet;
	}

	/**
	 * Call the Welcome endpoint of the Authentication Server and check whether the attributes that will be used for login/registration
	 * meet the requirements.
	 *
	 * @param loginMethod The login method that is currently used.
	 * @returns The set of attribute handles used in the login method that belong to identifying attributes.
	 */
	public async _welcomeEPAuths() {
		const welcomeResponseFn = () => this._authsApi.apiGET<mssTypes.AuthsWelcomeResp>(this._authsApi.apiURLS.welcome);
		const okWelcomeResp = await handleErrors<mssTypes.WelcomeResp>(welcomeResponseFn);
		return okWelcomeResp.attr_types;
	}
	public async YiviWaitForResultEP(argument: any) {
		const requestBody = { state: argument };
		const response = await this._authsApi.api(this._authsApi.apiURLS.YiviWaitForResultEP, requestOptions(requestBody));
		if (mssTypes.isOk(response)) {
			return response.Ok;
		} else {
			throw new Error('The response is not okay');
		}
	}
	public async CardEP(requestBody: mssTypes.CardReq) {
		const response = await this._authsApi.api<mssTypes.CardResp>(this._authsApi.apiURLS.cardEP, requestOptions(requestBody));
		if (mssTypes.isOk(response)) {
			return response.Ok;
		} else {
			throw new Error('The response is not okay');
		}
	}
	public async YiviReleaseNextSessionEP(requestBody: mssTypes.YiviReleaseNextSessionReq) {
		const response = await this._authsApi.api<mssTypes.YiviReleaseNextSessionResp>(this._authsApi.apiURLS.YiviReleaseNextSessionEP, requestOptions(requestBody));
		if (mssTypes.isOk(response)) {
			return response.Ok;
		} else {
			throw new Error('The response is not okay');
		}
	}

	/**
	 * Call the AuthStartEP to get the task and state.
	 *
	 * @returns The task and state returned by the AuthStartEP.
	 */
	public async _startAuthEP(requestBody: mssTypes.AuthStartReq) {
		const authStartRespFn = () => this._authsApi.api<mssTypes.AuthStartResp>(this._authsApi.apiURLS.authStart, requestOptions<mssTypes.AuthStartReq>(requestBody));
		const okAuthStartResp = await handleErrors<mssTypes.StartResp>(authStartRespFn);
		return okAuthStartResp;
	}

	/**
	 * Call the completeAuthEP to get the disclosed attributes.
	 *
	 * @param proof Proof that the end-user possesses the requested attributes.
	 * @param state The state that was obtained during the call of the AuthStartEP.
	 * @returns The attributes the user disclosed.
	 */
	public async _completeAuthEP(proof: mssTypes.AuthProof, state: number[]): Promise<mssTypes.SuccesResp> {
		const requestPayload: mssTypes.AuthCompleteReq = { proof, state };
		const authCompleteRespFn = () => this._authsApi.api<mssTypes.AuthCompleteResp>(this._authsApi.apiURLS.authComplete, requestOptions<mssTypes.AuthCompleteReq>(requestPayload));
		const okAuthCompleteResp = await handleErrors<mssTypes.CompleteResp>(authCompleteRespFn);
		if (okAuthCompleteResp === 'PleaseRestartAuth') {
			throw new Error('Something went wrong. Please start again at AuthStartEP.');
		} else if ('Success' in okAuthCompleteResp) {
			return okAuthCompleteResp.Success;
		} else {
			throw new Error('Unknown response from the completeAuth endpoint.');
		}
	}

	/**
	 * Start the authentication process.
	 *
	 * @returns The attributes the user disclosed.
	 */
	private async _authenticate(authStartReq: mssTypes.AuthStartReq, source: mssTypes.Source) {
		const startResp = await this._startAuthEP(authStartReq);
		if ('Success' in startResp) {
			const { task, state } = startResp.Success;
			this._state = state;
			if (source === mssTypes.Source.Yivi && task.Yivi) {
				const disclosureRequest = task.Yivi.disclosure_request;
				const yiviRequestorUrl = filters.removeTrailingSlash(task.Yivi.yivi_requestor_url);
				const resultJWT = await startYiviAuthentication(yiviRequestorUrl, disclosureRequest);
				const proof = { Yivi: { disclosure: resultJWT } };
				return await this._completeAuthEP(proof, this._state);
			} else {
				throw new Error(`The task does not match the chosen source for the attributes: ${task} (task), ${source} (source)`);
			}
		} else if ('UnknownAttrType' in startResp) {
			throw new Error(`No attribute type known with this handle: ${startResp.UnknownAttrType}`);
		} else if ('SourceNotAvailableFor' in startResp) {
			throw new Error(`The source (${authStartReq.source}) is not available for the attribute type with this handle: ${startResp.SourceNotAvailableFor}`);
		} else {
			throw new Error('Unknown response from the AuthStart endpoint.');
		}
	}

	/**
	 * A helper function to check whether the attributes the user disclosed are matching the attributes that were requested.
	 *
	 * @param attrTypes The list of attribute handles that were requested.
	 * @param responseAttrs The list of attribute handles that were disclosed.
	 * @returns True if the attributes are matching, false otherwise.
	 */
	public _responseEqualToRequested(responseAttrs: string[], attrTypes: readonly string[]): boolean {
		if (attrTypes.length !== responseAttrs.length) {
			return false;
		}

		const setA = new Set(attrTypes);
		const setB = new Set(responseAttrs);

		for (const value of setA) {
			if (!setB.has(value)) {
				return false;
			}
		}
		return true;
	}

	public _decodeJWT(jwt: string) {
		try {
			// Only take the payload of the JWT
			const base64Url = jwt.split('.')[1];
			const base64 = base64fromBase64Url(base64Url);
			// Decode the base64 encoded string to a buffer (bytes) and parse this buffer as JSON
			const jsonPayload = Buffer.from(base64, 'base64').toString();
			return JSON.parse(jsonPayload);
		} catch (e) {
			throw new Error('Invalid JWT');
		}
	}

	/**
	 * Starts the authentication process.
	 */
	async startAuthentication(loginMethod: mssTypes.LoginMethod, enterMode: mssTypes.PHCEnterMode) {
		const supportedAttrTypes = await this._welcomeEPAuths();
		const identifyingAttrsSet = this._checkAttributes(supportedAttrTypes, loginMethod, enterMode);
		const authStartReq: mssTypes.AuthStartReq = {
			source: loginMethod.source,
			attr_types: loginMethod.attr_types,
		};
		const authResp = await this._authenticate(authStartReq, loginMethod.source);
		assert.isDefined(authResp, 'Something went wrong.');
		if (this._responseEqualToRequested(Object.keys(authResp.attrs), loginMethod.attr_types)) {
			const signedAddAttrs: string[] = [];
			const signedIdentifyingAttrs: mssTypes.SignedIdentifyingAttrs = {};
			for (const [handle, attr] of Object.entries(authResp.attrs)) {
				if (identifyingAttrsSet.has(handle)) {
					const decodedAttr = this._decodeJWT(attr) as mssTypes.Attr;
					signedIdentifyingAttrs[handle] = { signedAttr: attr, id: decodedAttr.attr_type, value: decodedAttr.value };
				}
				if (handle !== loginMethod.identifying_attr) {
					signedAddAttrs.push(attr);
				}
			}
			return { identifyingAttr: authResp.attrs[loginMethod.identifying_attr], signedIdentifyingAttrs, signedAddAttrs };
		} else {
			throw new Error(`The disclosed attributes do not match the requested attributes`);
		}
	}

	async attrKeysEP(attrKeyRequest: mssTypes.AuthAttrKeyReq) {
		return await handleErrors<mssTypes.AttrKeysResp>(() => this._authsApi.api<mssTypes.AuthAttrKeysResp>(this._authsApi.apiURLS.attrKeys, requestOptions<mssTypes.AuthAttrKeyReq>(attrKeyRequest)));
	}
}

/**
 * Converts a base64url encoded string into a standard base64 string.
 *
 * @param base64Url The base64 url (unpadded) encoded string.
 * @returns The standard base64 string.
 */
export function base64fromBase64Url(base64Url: string) {
	// Change from base64url encoding to standard base64 encoding
	let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
	// Add padding to make sure the length of the base64 encoded string is a multiple of 4
	while (base64.length % 4) {
		base64 += '=';
	}
	return base64;
}

/**
 * Generate the options for a POST request to one of the API endpoints.
 *
 * @param requestBody What needs to be sent as the body of the request.
 * @returns The options that need to be sent with the POST request.
 */
export function requestOptions<T>(requestBody: T) {
	return {
		body: JSON.stringify(requestBody),
		headers: { 'Content-Type': 'application/json' },
		method: 'POST',
	};
}

// Use function overloads to specify different return types based on input (return type T instead of T | ArrayBuffer if response is a Result type)
export function handleErrorCodes<T, E = mssTypes.ErrorCode>(response: mssTypes.Result<T, E>): T;

export function handleErrorCodes<T, E = mssTypes.ErrorCode>(response: mssTypes.Result<T, E> | ArrayBuffer): T | ArrayBuffer;

export function handleErrorCodes<T, E = mssTypes.ErrorCode>(response: mssTypes.Result<T, E> | ArrayBuffer): T | ArrayBuffer {
	if (response instanceof ArrayBuffer) {
		return response;
	}
	if (mssTypes.isOk(response)) {
		return response.Ok;
	} else {
		if (!response || !response.Err) {
			throw new Error('The global-client received an undefined response in handleErrorCodes');
		}
		throw new Error(String(response.Err));
	}
}

// Use function overloads to specify different return types based on input (return type Promise<T> instead of Promise<T | ArrayBuffer> if apiCallFn returns a Result type)
export async function handleErrors<T>(apiCallFn: () => Promise<mssTypes.Result<T, mssTypes.ErrorCode>>, maxRetries?: number): Promise<T>;

export async function handleErrors<T>(apiCallFn: () => Promise<mssTypes.Result<T, mssTypes.ErrorCode> | ArrayBuffer>, maxRetries?: number): Promise<T | ArrayBuffer>;

export async function handleErrors<T>(apiCallFn: () => Promise<mssTypes.Result<T, mssTypes.ErrorCode> | ArrayBuffer>, maxRetries = 7): Promise<T | ArrayBuffer> {
	for (let retry = 0; retry < maxRetries; retry++) {
		try {
			const response = await apiCallFn();
			return handleErrorCodes<T>(response);
		} catch (error) {
			if (error instanceof Error && error.message === mssTypes.ErrorCode.PleaseRetry) {
				const delay = Math.min(10 * 2 ** retry, 1000);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			throw error;
		}
	}
	throw new Error(mssTypes.ErrorCode.PleaseRetry);
}
