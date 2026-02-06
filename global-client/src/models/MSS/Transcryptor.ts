// Logic
import { tr_api } from '@global-client/logic/core/api';

import { Api } from '@hub-client/logic/core/apiCore';

// Models
import { handleErrors, requestOptions } from '@global-client/models/MSS/Auths';
import * as mssTypes from '@global-client/models/MSS/TMultiServerSetup';

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
