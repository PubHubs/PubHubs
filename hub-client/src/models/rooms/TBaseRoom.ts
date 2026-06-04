// Packages
import { type IStateEvent } from 'matrix-js-sdk';

// Types (all: internal and freely added)
enum RoomType {
	PH_MESSAGES_DEFAULT = 'ph.messages.default',
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
	PH_MESSAGE_ADMIN_CONTACT = 'ph.messages.admin.contact',
	PH_MESSAGE_STEWARD_CONTACT = 'ph.messages.steward.contact',
	PH_FORUM_ROOM = 'ph.forum-room',
}
// RoomTypes that admin's can freely create
enum PublicRoomType {
	PH_NORMAL_ROOM = '',
	PH_FORUM_ROOM = 'ph.forum-room',
}

enum RoomCategory {
	PUBLIC = 'public',
	SECURED = 'secured',
	DIRECT = 'direct',
}

// map roomtypes to roomcategories
const RoomCategoryMap = {
	[RoomType.PH_MESSAGES_DEFAULT]: RoomCategory.PUBLIC,
	[RoomType.PH_FORUM_ROOM]: RoomCategory.PUBLIC,

	[RoomType.PH_MESSAGES_RESTRICTED]: RoomCategory.SECURED,

	[RoomType.PH_MESSAGES_DM]: RoomCategory.DIRECT,
	[RoomType.PH_MESSAGES_GROUP]: RoomCategory.DIRECT,
	[RoomType.PH_MESSAGE_ADMIN_CONTACT]: RoomCategory.DIRECT,
	[RoomType.PH_MESSAGE_STEWARD_CONTACT]: RoomCategory.DIRECT,
} satisfies Record<RoomType, RoomCategory>;

// get all the roomtypes of a category
function getRoomsByCategory(category: RoomCategory): RoomType[] {
	return Object.entries(RoomCategoryMap)
		.filter(([, cat]) => cat === category)
		.map(([roomType]) => roomType as RoomType);
}

const PublicRooms: RoomType[] = getRoomsByCategory(RoomCategory.PUBLIC);
const SecuredRooms: RoomType[] = getRoomsByCategory(RoomCategory.SECURED);
const DirectRooms: RoomType[] = getRoomsByCategory(RoomCategory.DIRECT);

type UnreadState = 'read' | 'unread' | 'unknown';

/** Returns the most urgent state: 'unread' > 'unknown' > 'read'. */
function worstUnreadState(states: UnreadState[]): UnreadState {
	let worst: UnreadState = 'read';
	for (const state of states) {
		if (state === 'unread') return 'unread';
		if (state === 'unknown') worst = 'unknown';
	}
	return worst;
}

/**
 * Whether a room's unread state should be surfaced in the UI — both in the
 * aggregate (miniclient) badge and the per-room sidebar badge.
 *
 * Forum rooms are excluded for now. (The 'main' thread-list view sends no
 * read receipts, so a 'unread' badge can never clear.)
 */
function showsUnreadState(roomType: string | undefined): boolean {
	return roomType !== RoomType.PH_FORUM_ROOM;
}

type RoomListRoom = {
	roomId: string;
	roomType: string;
	name: string;
	stateEvents: IStateEvent[];
	isHidden: boolean; // keep track of rooms that are removed from the list but are not synced yet
	unreadState: UnreadState;
};

/**
 * Shared base properties of rooms
 */
type TBaseRoom = {
	room_id: string;
	name?: string;
	topic?: string;
	user_txt?: string;
	room_type?: string;
};

export { TBaseRoom, UnreadState, worstUnreadState, showsUnreadState, RoomListRoom, RoomType, PublicRoomType, PublicRooms, SecuredRooms, DirectRooms };
