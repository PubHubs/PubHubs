// Logic
import { tr_api } from '@global-client/logic/core/api';

import { Api } from '@hub-client/logic/core/apiCore';

// Models
import { handleErrors, requestOptions } from '@global-client/models/MSS/Auths';

export default class Transcryptor {
	private _trApi: Api;

	constructor(transcryptorUrl: string) {
		this._trApi = tr_api(transcryptorUrl);
	}

	async ehppEP(nonce: string, id: string, ppp: string) {
		const requestPayload: MSS.EhpppReq = {
			hub_nonce: nonce,
			hub: id,
			ppp,
		};
		const okEhppResp = await handleErrors<MSS.EhppResp>(() => this._trApi.api<MSS.TrEhppResp>(this._trApi.apiURLS.encryptedHubPseudonymPackage, requestOptions<MSS.EhpppReq>(requestPayload)));
		if (okEhppResp === 'RetryWithNewPpp') {
			return okEhppResp;
		} else if ('Success' in okEhppResp) {
			return okEhppResp.Success;
		} else {
			throw new Error('Unknown response from the ehpp endpoint.');
		}
	}
}
