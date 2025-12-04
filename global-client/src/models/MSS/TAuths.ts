import { ErrorCode, Result } from '@global-client/models/MSS/TGeneral';

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
	readonly identifying_attr: string[];
	readonly login_choices: string[][];
	readonly register_attr: string[];
};

export const loginMethods: Record<string, LoginMethod> = {
	Yivi: {
		source: Source.Yivi,
		attr_types: ['email', 'phone', 'ph_card'],
		identifying_attr: ['email', 'ph_card'],
		login_choices: [['ph_card', 'email']],
		register_attr: ['email', 'phone'],
	},
} as const;

export type AuthStartReq = {
	source: Source;
	attr_types: readonly string[];
	attr_type_choices: string[][];
	yivi_chained_session: boolean;
};

type AuthTask = {
	Yivi: {
		disclosure_request: string;
		yivi_requestor_url: string;
	};
};
export type YiviWaitForResultResp = { Success: { disclosure: string } } | { PleaseRestartAuth: string } | { SessionGone: string };

export type YiviReleaseNextSessionResp = { Success: {} } | { PleaseRestartAuth: string } | { SessionGone: string } | { TooEarly: string };

export type YiviReleaseNextSessionReq = { state: number[]; next_session?: string };

export type CardResp = { Success: { attr: string; issuance_request: string; yivi_requestor_url: string } } | { PleaseRetryWithNewCardPseud: string };

export type CardReq = { card_pseud_package: { card_pseud: number; registration_date?: Number }; comment: string };

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

export type SuccesResp = { attrs: Record<string, string> };

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
