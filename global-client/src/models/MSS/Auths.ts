// Logic
import { auths_api } from '@global-client/logic/core/api';
import { handleErrors, requestOptions } from '@global-client/logic/utils/mssUtils';

import { Api } from '@hub-client/logic/core/apiCore';

// Models
import * as TAuths from '@global-client/models/MSS/TAuths';
import { ErrorCode, Result, ResultResponse } from '@global-client/models/MSS/TGeneral';
import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

export default class AuthenticationServer {
	private _state: number[];
	private readonly _authsApi: Api;

	constructor(authServerUrl: string) {
		this._state = [];
		this._authsApi = auths_api(authServerUrl);
	}
	public getState() {
		return this._state;
	}
	public setState(newState: number[]) {
		this._state = newState;
	}

	/**
	 * Check whether the attributes that will be used for registration/login are in the list of supported attribute types
	 * and if they contain at least one identifying and at least one bannable attribute.
	 *
	 * @param supportedAttrTypes The list of attributes supported by PubHubs.
	 * @param loginMethod The login method that is currently used.
	 * @returns A set of the handles used in the login method that are identifying and thus can be used to login.
	 */
	public checkAttributes(supportedAttrTypes: Record<string, TAuths.AttrType>, loginMethod: TAuths.LoginMethod, enterMode: PHCEnterMode): Set<string> {
		if (!loginMethod.attr_types.some((attr) => loginMethod.identifying_attr.includes(attr))) {
			throw new Error(`The attributes "${loginMethod.attr_types}" do not include an identifying attribute from in the attribute list.`);
		}
		// Build a map from all handles (current handle + old handles) to the attributes for efficient lookup
		const handleToAttrMap = new Map<string, TAuths.AttrType>();

		for (const [handle, attr] of Object.entries(supportedAttrTypes)) {
			handleToAttrMap.set(handle, attr); // active handle mapping
			attr.handles.forEach((oldHandle) => {
				handleToAttrMap.set(oldHandle, attr);
			});
		}

		const identifyingAttrsSet = new Set<string>();
		let hasIdentifying = false;
		// To login no bannable attribute is needed (apart from when there is not yet a bannable attribute registered, but then the enterEP will throw an error).
		let hasBannable = enterMode === PHCEnterMode.Login;

		for (const attr of loginMethod.attr_types) {
			const type: TAuths.AttrType | undefined = handleToAttrMap.get(attr);

			if (!type) {
				throw new Error(`The attribute "${attr}" is not in the list of supported attributes.`);
			}

			if (loginMethod.identifying_attr.includes(attr) && !type.identifying) {
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
	public async welcomeEPAuths(): Promise<Record<string, TAuths.AttrType>> {
		const welcomeResponseFn = () => this._authsApi.apiGET<TAuths.AuthsWelcomeResp>(this._authsApi.apiURLS.welcome);
		const okWelcomeResp = await handleErrors<TAuths.WelcomeResp>(welcomeResponseFn);
		return okWelcomeResp.attr_types;
	}
	public async YiviWaitForResultEP(argument: any): Promise<TAuths.YiviWaitForResultResp> {
		const requestBody = { state: argument };
		const YiviWaitForResulFn = () => this._authsApi.api<Result<TAuths.YiviWaitForResultResp, ErrorCode>>(this._authsApi.apiURLS.YiviWaitForResultEP, requestOptions(requestBody));
		return await handleErrors<TAuths.YiviWaitForResultResp>(YiviWaitForResulFn);
	}
	public async CardEP(requestBody: TAuths.CardReq): Promise<TAuths.CardResp> {
		const CardFn = () => this._authsApi.api<Result<TAuths.CardResp, ErrorCode>>(this._authsApi.apiURLS.cardEP, requestOptions(requestBody));
		return await handleErrors<TAuths.CardResp>(CardFn);
	}
	public async YiviReleaseNextSessionEP(requestBody: TAuths.YiviReleaseNextSessionReq): Promise<TAuths.YiviReleaseNextSessionResp> {
		const YiviReleaseNextSessioFn = () => this._authsApi.api<Result<TAuths.YiviReleaseNextSessionResp, ErrorCode>>(this._authsApi.apiURLS.YiviReleaseNextSessionEP, requestOptions(requestBody));
		return await handleErrors<TAuths.YiviReleaseNextSessionResp>(YiviReleaseNextSessioFn);
	}

	/**
	 * Call the AuthStartEP to get the task and state.
	 *
	 * @returns The task and state returned by the AuthStartEP.
	 */
	public async authStartEP(requestBody: TAuths.AuthStartReq): Promise<TAuths.StartRespSuccess> {
		const authStartRespFn = () => this._authsApi.api<TAuths.AuthStartResp>(this._authsApi.apiURLS.authStart, requestOptions<TAuths.AuthStartReq>(requestBody));
		const okAuthStartResp = await handleErrors<TAuths.StartResp>(authStartRespFn);
		if ('UnknownAttrType' in okAuthStartResp) {
			throw new Error(`Unknown attribute handle: ${okAuthStartResp.UnknownAttrType}`);
		}
		if ('SourceNotAvailableFor' in okAuthStartResp) {
			throw new Error(`Source ${requestBody.source} not available for attribute: ${okAuthStartResp.SourceNotAvailableFor}`);
		}
		if (!(ResultResponse.Success in okAuthStartResp)) {
			throw new Error('Unexpected response from startAuth.');
		}
		return okAuthStartResp.Success;
	}

	/**
	 * Call the completeAuthEP to get the disclosed attributes.
	 *
	 * @param proof Proof that the end-user possesses the requested attributes.
	 * @param state The state that was obtained during the call of the AuthStartEP.
	 * @returns The attributes the user disclosed.
	 */
	public async completeAuthEP(proof: TAuths.AuthProof, state: number[]): Promise<TAuths.SuccesResp> {
		const requestPayload: TAuths.AuthCompleteReq = { proof, state };
		const authCompleteRespFn = () => this._authsApi.api<TAuths.AuthCompleteResp>(this._authsApi.apiURLS.authComplete, requestOptions<TAuths.AuthCompleteReq>(requestPayload));
		const okAuthCompleteResp = await handleErrors<TAuths.CompleteResp>(authCompleteRespFn);
		if (okAuthCompleteResp === 'PleaseRestartAuth') {
			throw new Error('Something went wrong. Please start again at AuthStartEP.');
		} else if ('Success' in okAuthCompleteResp) {
			return okAuthCompleteResp.Success;
		} else {
			throw new Error('Unknown response from the completeAuth endpoint.');
		}
	}

	async attrKeysEP(attrKeyRequest: TAuths.AuthAttrKeyReq) {
		return await handleErrors<TAuths.AttrKeysResp>(() => this._authsApi.api<TAuths.AuthAttrKeysResp>(this._authsApi.apiURLS.attrKeys, requestOptions<TAuths.AuthAttrKeyReq>(attrKeyRequest)));
	}
}
