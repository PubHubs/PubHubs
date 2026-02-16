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
	Admin = 'Admin',
	SuperSteward = 'SuperSteward',
	Steward = 'Steward',
	Expert = 'Expert',
	User = 'User',
	NoRole = '',
}

export enum UserPowerLevel {
	Admin = 100,
	SuperSteward = 75,
	Steward = 50,
	Expert = 25,
	User = 0,
}

// Actions that the user can carry out
export enum UserAction {
	Invite = 'Invite',
	AdminPanel = 'AdminPanel',
	StewardPanel = 'StewardPanel',
	MessageAdmin = 'MessageAdmin',
	MessageSteward = 'MessageSteward',
	RoomAnnouncement = 'RoomAnnouncement',
}

// Which actions which role can perform
export const roleActions = {
	[TUserRole.Admin]: [UserAction.Invite, UserAction.AdminPanel, UserAction.RoomAnnouncement],
	[TUserRole.SuperSteward]: [UserAction.Invite],
	[TUserRole.Steward]: [UserAction.StewardPanel, UserAction.RoomAnnouncement],
	[TUserRole.Expert]: [UserAction.MessageSteward],
	[TUserRole.User]: [],
};

export type TUserJoinedRooms = {
	joined_rooms: string[];
	total: number;
};
