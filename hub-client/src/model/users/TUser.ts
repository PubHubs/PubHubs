export type TUser = {
	userId: string;
	rawDisplayName?: string;
};

export type TUserAccount = {
	name: string;
	user_type: string | null;
	is_guest: boolean;
	admin: boolean;
	deactivated: boolean;
	shadow_banned: boolean;
	displayname: string;
	avatar_url: string;
	creation_ts: number;
	approved: boolean;
	erased: boolean;
	last_seen_ts: number | null;
	locked: boolean;
};

export type TUserAccountList = {
	users: TUserAccount[];
	next_token: string;
	total: number;
};

export enum TUserRole {
	User = 'User',
	Steward = 'Steward',
	Administrator = 'Administrator',
}

export type TUserJoinedRooms = {
	joined_rooms: string[];
	total: number;
};
