import { type ErrorCode, type Result } from '@global-client/models/MSS/TGeneral';

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
	register_only_with_unique_attrs: boolean;
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

export type CardPseudResp = { RetryWithNewAuthToken: string; Success: CardPseudRespSucces };

export type CardPseudRespSucces = { card_pseud: number; registration_date?: number };

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
		// From version 2 on the key is attrValueKey(attrId, attrValue), before that the attribute value itself.
		[attrValueKey: string]: {
			ts: string;
			encUserSecret: string;
		};
	};
};

export type UserSecretObjectNew = {
	version: number;
	data: UserSecretData;
};

export type UserSecretObject = UserSecretData | UserSecretObjectNew;

export function isUserSecretObjectNew(obj: unknown): obj is UserSecretObjectNew {
	return obj !== null && obj !== undefined && typeof obj === 'object' && 'data' in obj;
}

export function getUserSecretData(obj: UserSecretObject): UserSecretData {
	if (isUserSecretObjectNew(obj)) {
		return obj.data;
	} else {
		return obj;
	}
}

/**
 * The key the entry for an attribute value is stored under in a user secret object: SHA-256 over
 * `${attrId}\u0000${attrValue}`, base64url encoded without padding. PHC stores the object as it is,
 * so keying by the value itself would hand PHC every user's email address.
 */
export async function attrValueKey(attrId: string, attrValue: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${attrId}\u0000${attrValue}`));
	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

/**
 * The data of a user secret object with every entry under its attrValueKey(), whatever version the
 * object was written in. Objects from before version 2 (including the bare map without a version)
 * are keyed by the attribute value itself; those keys are hashed here, every one of them, so an
 * object written from the result holds no attribute value. Returns a new map and leaves `obj` as it is.
 */
export async function getHashedUserSecretData(obj: UserSecretObject): Promise<UserSecretData> {
	const keysAreHashed = isUserSecretObjectNew(obj) && obj.version >= 2;
	const hashedData: UserSecretData = {};
	for (const [attrId, entries] of Object.entries(getUserSecretData(obj))) {
		hashedData[attrId] = {};
		for (const [key, entry] of Object.entries(entries)) {
			hashedData[attrId][keysAreHashed ? key : await attrValueKey(attrId, key)] = entry;
		}
	}
	return hashedData;
}

export type PppResp = 'RetryWithNewAuthToken' | { Success: string };

export type PHCPppResp = Result<PppResp, ErrorCode>;

export type HhppReq = {
	ehpp: string;
	hhpp_signature_scheme?: string;
};

export type HhppResp = 'RetryWithNewPpp' | 'RetryWithNewAuthToken' | { Success: string };

export type PHCHhppResp = Result<HhppResp, ErrorCode>;
