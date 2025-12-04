// Logic
import { tr_api } from '@global-client/logic/core/api';
import { handleErrors, requestOptions } from '@global-client/logic/utils/mssUtils';

import { Api } from '@hub-client/logic/core/apiCore';

// Models
import { EhppResp, EhpppReq, TrEhppResp } from '@global-client/models/MSS/TTranscryptor';

export default class Transcryptor {
	private readonly _trApi: Api;

	constructor(transcryptorUrl: string) {
		this._trApi = tr_api(transcryptorUrl);
	}

	async ehppEP(nonce: string, id: string, ppp: string) {
		const requestPayload: EhpppReq = {
			hub_nonce: nonce,
			hub: id,
			ppp,
		};
		const okEhppResp = await handleErrors<EhppResp>(() => this._trApi.api<TrEhppResp>(this._trApi.apiURLS.encryptedHubPseudonymPackage, requestOptions<EhpppReq>(requestPayload)));
		if (okEhppResp === 'RetryWithNewPpp') {
			return okEhppResp;
		} else if ('Success' in okEhppResp) {
			return okEhppResp.Success;
		} else {
			throw new Error('Unknown response from the ehpp endpoint.');
		}
	}
}
