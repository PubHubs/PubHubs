import type Room from '@hub-client/models/rooms/Room';

/**
 * Gets all joined members of a room, excluding system users (notices_user).
 */
const getRoomMembers = (room: Room): string[] => {
	return room
		.getStateJoinedMembers()
		.filter((m) => !m.state_key.startsWith('@notices_user:'))
		.map((m) => m.sender);
};

/**
 * Gets all joined members of a room except the specified user.
 */
const getOtherRoomMembers = (room: Room, currentUserId: string | null): string[] => {
	return getRoomMembers(room).filter((userId) => userId !== currentUserId);
};

export { getOtherRoomMembers, getRoomMembers };
