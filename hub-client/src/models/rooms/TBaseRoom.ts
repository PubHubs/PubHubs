// Packages
import { IStateEvent } from 'matrix-js-sdk';

// Types
enum RoomType {
	PH_MESSAGES_DEFAULT = 'ph.messages.default',
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
	PH_MESSAGE_ADMIN_CONTACT = 'ph.messages.admin.contact',
	PH_MESSAGE_STEWARD_CONTACT = 'ph.messages.steward.contact',
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

/**
 * Type for display of Rooms in the Roomlist-menu
 */
type RoomListRoom = {
	roomId: string;
	roomType: string;
	name: string;
	stateEvents: IStateEvent[];
	lastMessageId: string | undefined; // id of the newest message, used as base for the roomtimeline (this paginates forward to catch the newly added events)
	isHidden: boolean; // keep track of rooms that are removed from the list but are not synced yet
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

export { TBaseRoom, RoomListRoom, RoomType, PublicRooms, SecuredRooms, DirectRooms };
