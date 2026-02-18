type TUser = {
	userId: string;
	rawDisplayName?: string;
};

type TUserAccount = {
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

type TUserAccountList = {
	users: TUserAccount[];
	next_token: string;
	total: number;
};

enum UserRole {
	Admin = 'Admin',
	SuperSteward = 'SuperSteward',
	Steward = 'Steward',
	Expert = 'Expert',
	User = 'User',
}

enum UserPowerLevel {
	Admin = 100,
	SuperSteward = 75,
	Steward = 50,
	Expert = 25,
	User = 0,
}

// Actions that the user can carry out
enum UserAction {
	Invite = 'Invite',
	AdminPanel = 'AdminPanel',
	StewardPanel = 'StewardPanel',
	MessageAdmin = 'MessageAdmin',
	MessageSteward = 'MessageSteward',
	RoomAnnouncement = 'RoomAnnouncement',
}

// Which actions which role can perform
const UserRoleActions = {
	[UserRole.Admin]: [UserAction.Invite, UserAction.AdminPanel, UserAction.RoomAnnouncement],
	[UserRole.SuperSteward]: [UserAction.Invite, UserAction.StewardPanel, UserAction.RoomAnnouncement],
	[UserRole.Steward]: [UserAction.StewardPanel, UserAction.RoomAnnouncement],
	[UserRole.Expert]: [UserAction.MessageSteward],
	[UserRole.User]: [UserAction.MessageSteward],
} as Record<UserRole, UserAction[]>;

type TUserJoinedRooms = {
	joined_rooms: string[];
	total: number;
};

export { TUser, TUserAccount, TUserAccountList, UserRole, UserPowerLevel, UserAction, UserRoleActions, TUserJoinedRooms };
