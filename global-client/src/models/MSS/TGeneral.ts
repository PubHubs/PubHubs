// #region General
export enum ErrorCode {
	PleaseRetry = 'PleaseRetry',
	InternalError = 'InternalError',
	BadRequest = 'BadRequest',
}

export enum ResultResponse {
	Success = 'Success',
}

export type Result<T, E> = { Ok: T } | { Err: E };

// Type guard to check if the result is of type Ok
export function isOk<T, E>(result: Result<T, E>): result is { Ok: T } {
	return 'Ok' in result;
}

// Type guard to check if the result is of type Err
export function isErr<T, E>(result: Result<T, E>): result is { Err: E } {
	return 'Err' in result;
}

// #endregion

// #region Hub API

export type InfoResp = {
	verifying_key: string;
	hub_version: string;
	hub_client_url: string;
};

export type EnterStartResp = {
	state: string;
	nonce: string;
};

export type HubEnterStartResp = Result<EnterStartResp, ErrorCode>;

export type HubEnterCompleteReq = {
	state: string;
	hhpp: string;
};

export type EnterCompleteResp =
	| 'RetryFromStart'
	| {
			Entered: {
				access_token: string;
				device_id: string;
				new_user: boolean;
				mxid: string;
			};
	  };

export type HubEnterCompleteResp = Result<EnterCompleteResp, ErrorCode>;
// #endregion
