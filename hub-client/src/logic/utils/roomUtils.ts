import { type IStateEvent } from 'matrix-js-sdk';

import type Room from '@hub-client/models/rooms/Room';

/**
 * Gets all joined members of a room, excluding system users (notices_user).
 */
const getRoomMembers = (room: Room): string[] => {
	return room
		.getStateJoinedMembers()
		.filter((m) => !m.state_key.startsWith('@notices_user:'))
		.map((m) => m.state_key);
};

/**
 * Gets all joined members of a room except the specified user.
 */
const getOtherRoomMembers = (room: Room, currentUserId: string | null): string[] => {
	return getRoomMembers(room).filter((userId) => userId !== currentUserId);
};

/**
 * Merges new state events into the existing ones, keyed by (type, state_key), keeping the
 * newest event per key.
 * @param mergeFrom new state events
 * @param mergeTo existing state events
 */
const mergeStateEvents = (mergeFrom: IStateEvent[], mergeTo: IStateEvent[]): void => {
	for (const newEvent of mergeFrom) {
		const existingIndex = mergeTo.findIndex((e) => e.type === newEvent.type && e.state_key === newEvent.state_key);
		if (existingIndex < 0) {
			mergeTo.push(newEvent);
		} else if (newEvent.origin_server_ts >= mergeTo[existingIndex].origin_server_ts) {
			mergeTo[existingIndex] = newEvent;
		}
	}
};

export { getOtherRoomMembers, getRoomMembers, mergeStateEvents };
