import { ErrorCode, Result } from '@global-client/models/MSS/TGeneral';

export type EhpppReq = {
	hub_nonce: string;
	hub: string;
	ppp: string;
};

export type EhppResp = 'RetryWithNewPpp' | { Success: string };

export type TrEhppResp = Result<EhppResp, ErrorCode>;
