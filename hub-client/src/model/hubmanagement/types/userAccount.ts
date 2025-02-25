export type UserAccount = {
	name: string;
	displayname: string | null;
	threepids: Array<{
		medium: string;
		address: string;
		added_at: number;
		validated_at: number;
	}>;
	avatar_url: string | null;
	is_guest: number;
	admin: number;
	deactivated: number;
	erased: boolean;
	shadow_banned: number;
	creation_ts: number;
	appservice_id: string | null;
	consent_server_notice_sent: string | null;
	consent_version: string | null;
	consent_ts: number | null;
	external_ids: Array<{
		auth_provider: string;
		external_id: string;
	}>;
	user_type: string | null;
	locked: boolean;
	suspended: boolean;
};
