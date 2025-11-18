import { ErrorCode, Result } from '@global-client/models/MSS/TGeneral';

export type Constellation = {
	id: string;
	created_at: number;
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
	global_client_url: string;
	ph_version: string;
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
	identifying_attr?: string;
	mode: PHCEnterMode;
	add_attrs: Array<string>;
};

export type Attr = {
	attr_type: string;
	value: string;
	bannable: boolean;
	not_identifying: boolean;
	not_addable: boolean;
};

export enum AuthTokenDeniedReason {
	NoBannableAttribute = 'NoBannableAttribute',
	Banned = 'Banned',
}

export enum AttrAddStatus {
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

export type CardPseudResp = { RetryWithNewAuthToken: string; Success: { card_pseud: number; registration_date?: Number } };

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
				stored_objects: Record<string, UserObjectDetails>;
			};
	  };

export type PHCStoreObjectResp = Result<StoreObjectResp, ErrorCode>;

export type UserSecretData = {
	[attrId: string]: {
		[attrValue: string]: {
			ts: string;
			encUserSecret: string;
		};
	};
};

type UserSecretObjectOld = UserSecretData;

export type UserSecretObjectNew = {
	version: number;
	data: UserSecretData;
};

export type UserSecretObject = UserSecretObjectOld | UserSecretObjectNew;

export function isUserSecretObjectNew(obj: any): obj is UserSecretObjectNew {
	return obj && typeof obj === 'object' && 'data' in obj;
}

export type PppResp = 'RetryWithNewAuthToken' | { Success: string };

export type PHCPppResp = Result<PppResp, ErrorCode>;

export type HhppReq = {
	ehpp: string;
};

export type HhppResp = 'RetryWithNewPpp' | 'RetryWithNewAuthToken' | { Success: string };

export type PHCHhppResp = Result<HhppResp, ErrorCode>;
