// Logic
import { type PowerLevelsUsers, findPowerLevelsContent, powerLevelOf } from '@hub-client/logic/utils/powerLevelUtils';

// Models
import { DirectRooms, type RoomListRoom, type RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

/**
 * The single place power levels are read from local state.
 * A loaded Room is preferred; rooms that are only in the room list fall back to its sliding-sync state.
 */
const usePowerLevels = () => {
	const roomsStore = useRooms();
	const userStore = useUser();

	const powerLevelsContent = (roomId: string): PowerLevelsUsers | undefined =>
		roomsStore.room(roomId)?.getPowerLevelsContent() ?? findPowerLevelsContent(roomsStore.roomList.find((entry) => entry.roomId === roomId)?.stateEvents);

	/**
	 * @param userId defaults to the current user
	 */
	const powerLevel = (roomId: string, userId: string | null | undefined = userStore.userId): number => powerLevelOf(powerLevelsContent(roomId), userId);

	/**
	 * Users with an explicit power level in the room. Users only covered by users_default are not listed.
	 */
	const powerLevelUsers = (roomId: string): Record<string, number> => powerLevelsContent(roomId)?.users ?? {};

	/**
	 * Room list entries (except direct messages) in which the user has at least the given power level.
	 * @param userId defaults to the current user
	 */
	const roomsWithPowerLevel = (minLevel: UserPowerLevel, userId: string | null | undefined = userStore.userId): RoomListRoom[] =>
		roomsStore.roomList.filter((entry) => !DirectRooms.includes(entry.roomType as RoomType) && powerLevel(entry.roomId, userId) >= minLevel);

	/**
	 * Highest power level the current user holds across rooms (except direct messages).
	 * Synapse-admin status is intentionally excluded; that policy lives in roles.composable.
	 */
	const maxRoomPowerLevel = (): number => {
		if (!userStore.userId) return UserPowerLevel.User;
		return roomsStore.roomList
			.filter((entry) => !DirectRooms.includes(entry.roomType as RoomType))
			.reduce((highest, entry) => Math.max(highest, powerLevel(entry.roomId)), UserPowerLevel.User as number);
	};

	return { maxRoomPowerLevel, powerLevel, powerLevelsContent, powerLevelUsers, roomsWithPowerLevel };
};

export { usePowerLevels };
