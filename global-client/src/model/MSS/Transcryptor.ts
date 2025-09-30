// Global imports
import { tr_api } from '@/logic/core/api.js';
import * as mssTypes from '@/model/MSS/TMultiServerSetup.js';
import { requestOptions, handleErrors } from '@/model/MSS/Auths.js';

// Hub imports
import { Api } from '@/../../../hub-client/src/logic/core/apiCore.js';

export default class Transcryptor {
	private _trApi: Api;

	constructor(transcryptorUrl: string) {
		this._trApi = tr_api(transcryptorUrl);
	}

	async ehppEP(nonce: string, id: string, ppp: string) {
		const requestPayload: mssTypes.EhpppReq = {
			hub_nonce: nonce,
			hub: id,
			ppp,
		};
		const okEhppResp = await handleErrors<mssTypes.EhppResp>(() => this._trApi.api<mssTypes.TrEhppResp>(this._trApi.apiURLS.encryptedHubPseudonymPackage, requestOptions<mssTypes.EhpppReq>(requestPayload)));
		if (okEhppResp === 'RetryWithNewPpp') {
			return okEhppResp;
		} else if ('Success' in okEhppResp) {
			return okEhppResp.Success;
		} else {
			throw new Error('Unknown response from the ehpp endpoint.');
		}
	}
}
