// #region General
export enum ErrorCode {
	PleaseRetry = 'PleaseRetry',
	InternalError = 'InternalError',
	BadRequest = 'BadRequest',
}

export enum ResultResponse {
	Success = 'Success',
}
// Type guard to check if a variable is of type Result
export function isResult<T, E>(value: unknown): value is Result<T, E> {
	return typeof value === 'object' && value !== null && ('Ok' in value || 'Err' in value);
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

export type HubInfoResp = Result<InfoResp, ErrorCode>;

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

export type ReturnCard = { cardAttr: null; errorMessage: { key: string; values?: string[] | undefined } } | { cardAttr: { signedAttr: string; id: string; value: string }; errorMessage: null };

export interface DecodedAttributes {
	identifying: Record<string, { signedAttr: string; id: string; value: string }>;
	additional: string[];
}
// #endregion
