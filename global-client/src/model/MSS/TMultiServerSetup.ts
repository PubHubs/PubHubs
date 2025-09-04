// #region General
export enum ErrorCode {
	PleaseRetry = 'PleaseRetry',
	InternalError = 'InternalError',
	BadRequest = 'BadRequest',
}

export type Result<T, E> = { Ok: T } | { Err: { errorCode: E } };

// Type guard to check if the result is of type Ok
export function isOk<T, E>(result: Result<T, E>): result is { Ok: T } {
	return 'Ok' in result;
}

// Type guard to check if the result is of type Err
export function isErr<T, E>(result: Result<T, E>): result is { Err: { errorCode: E } } {
	return 'Err' in result;
}

// #endregion

// #region Auth Server

type AttrSource = {
	Yivi: {
		attr_type_id: string;
	};
};

export type AttrType = {
	id: string;
	handles: string[];
	bannable: boolean;
	identifying: boolean;
	sources: AttrSource[];
};

export type WelcomeResp = { attr_types: Record<string, AttrType> };

export type AuthsWelcomeResp = Result<WelcomeResp, ErrorCode>;

export enum Source {
	Yivi = 'Yivi',
}

export type LoginMethod = {
	readonly source: Source;
	readonly attr_types: readonly string[];
	readonly identifying_attr: string;
};

export const loginMethods: Record<string, LoginMethod> = {
	Yivi: { source: Source.Yivi, attr_types: ['email', 'phone'], identifying_attr: 'email' },
} as const;

export type AuthStartReq = {
	source: Source;
	attr_types: readonly string[];
};

type AuthTask = {
	Yivi: {
		disclosure_request: string;
		yivi_requestor_url: string;
	};
};

export type StartResp = { Success: { task: AuthTask; state: Array<number> } } | { UnknownAttrType: string } | { SourceNotAvailableFor: string };

export type AuthStartResp = Result<StartResp, ErrorCode>;

export type AuthProof = {
	Yivi: {
		disclosure: string;
	};
};

export type AuthCompleteReq = {
	proof: AuthProof;
	state: Array<number>;
};

export type CompleteResp = { Success: { attrs: Record<string, string> } } | 'PleaseRestartAuth';

export type SignedIdentifyingAttrs = Record<string, { signedAttr: string; id: string; value: string }>;

export type AuthCompleteResp = Result<CompleteResp, ErrorCode>;

export type AttrKeyReq = {
	attr: string;
	timestamp: string | null;
};

export type AuthAttrKeyReq = Record<string, AttrKeyReq>;

export type AttrKeyResp = {
	latest_key: [string, string];
	old_key: string | null;
};

export type AttrKeysResp = { RetryWithNewAttr: string } | { Success: Record<string, AttrKeyResp> };

export type AuthAttrKeysResp = Result<AttrKeysResp, ErrorCode>;

// #endregion

// #region PHC server

export type Constellation = {
	id: string;
	transcryptor_url: string;
	transcryptor_jwt_key: string;
	transcryptor_enc_key: string;
	transcryptor_master_enc_key_part: string;
	phc_url: string;
	phc_jwt_key: string;
	phc_enc_key: string;
	auths_url: string;
	auths_jwt_key: string;
	auths_enc_key: string;
	master_enc_key: string;
};

export type HubInformation = {
	handles: string[];
	name: string;
	description: string;
	url: string;
	id: string;
};

export type WelcomeRespPHC = {
	constellation: Constellation;
	hubs: Record<string, HubInformation>;
};

export type PHCWelcomeResp = Result<WelcomeRespPHC, ErrorCode>;

export enum PHCEnterMode {
	Login = 'Login',
	Register = 'Register',
	LoginOrRegister = 'LoginOrRegister',
}

export type PHCEnterReq = {
	identifying_attr: string;
	mode: PHCEnterMode;
	add_attrs: Array<string>;
};

export type Attr = {
	attr_type: string;
	value: string;
	bannable: boolean;
	identifying: boolean;
};

export enum AuthTokenDeniedReason {
	NoBannableAttribute = 'NoBannableAttribute',
	Banned = 'Banned',
}

enum AttrAddStatus {
	AlreadyThere = 'AlreadyThere',
	Added = 'Added',
	PleaseTryAgain = 'PleaseTryAgain',
}

export type AuthTokenPackage = {
	auth_token: string;
	expires: bigint;
};

export type EnterResp =
	| 'AccountDoesNotExist'
	| { AttributeBanned: Attr }
	| 'Banned'
	| { AttributeAlreadyTaken: Attr }
	| 'NoBannableAttribute'
	| 'RetryWithNewIdentifyingAttr'
	| {
			RetryWithNewAddAttr: {
				index: number;
			};
	  }
	| {
			Entered: {
				new_account: boolean;
				auth_token_package: Result<AuthTokenPackage, AuthTokenDeniedReason>;
				attr_status: Array<[Attr, AttrAddStatus]>;
			};
	  };

export type PHCEnterResp = Result<EnterResp, ErrorCode>;

export type RefreshResp = 'ReobtainAuthToken' | { Denied: AuthTokenDeniedReason } | { Success: AuthTokenPackage };

export type PHCRefreshResp = Result<RefreshResp, ErrorCode>;

export type UserObjectDetails = {
	hash: string;
	hmac: string;
	size: number;
};

type UserState = {
	allow_login_by: string[];
	could_be_banned_by: string[];
	stored_objects: Record<string, UserObjectDetails>;
};

export type StateResp = 'RetryWithNewAuthToken' | { State: UserState };

export type PHCStateResp = Result<StateResp, ErrorCode>;

export enum GetObjectRespProblem {
	RetryWithNewHmac = 'RetryWithNewHmac',
	NotFound = 'NotFound',
}

export type PHCGetObjectResp = Result<GetObjectRespProblem, ErrorCode>;

enum QuotumName {
	ObjectCount = 'ObjectCount',
	ObjectBytesTotal = 'ObjectBytesTotal',
}

export type StoreObjectResp =
	| 'PleaseRetry'
	| 'RetryWithNewAuthToken'
	| 'MissingHash'
	| 'NotFound'
	| 'HashDidNotMatch'
	| 'NoChanges'
	| { QuotumReached: QuotumName }
	| {
			Stored: {
				hash: string;
			};
	  };

export type PHCStoreObjectResp = Result<StoreObjectResp, ErrorCode>;

export type UserSecretObject = {
	[attrId: string]: {
		[attrValue: string]: {
			ts: string;
			encUserSecret: string;
		};
	};
};

export type PppResp = 'RetryWithNewAuthToken' | { Success: string };

export type PHCPppResp = Result<PppResp, ErrorCode>;

export type HhppReq = {
	ehpp: string;
};

export type HhppResp = 'RetryWithNewPpp' | 'RetryWithNewAuthToken' | { Success: string };

export type PHCHhppResp = Result<HhppResp, ErrorCode>;

// #endregion

// #region Transcryptor

export type EhpppReq = {
	hub_nonce: string;
	hub: string;
	ppp: string;
};

export type EhppResp = 'RetryWithNewPpp' | { Success: string };

export type TrEhppResp = Result<EhppResp, ErrorCode>;

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
