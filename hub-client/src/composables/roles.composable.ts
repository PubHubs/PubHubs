import { assert } from 'chai';

import { roles } from '@hub-client/models/constants';
import { TUserRole } from '@hub-client/models/users/TUser';

import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

/**
 * This handles user roles and permissions.
 * Given the current or given room and the current user.
 */

function useRoles() {
	const userStore = useUser();
	const roomsStore = useRooms();

	const currentRoomId = (): string | undefined => {
		const room = roomsStore.currentRoom;
		if (!room) return undefined;
		return room.roomId;
	};

	const userPowerLevel = (roomId: string | undefined = undefined): number => {
		const user = userStore.user;
		let room = roomsStore.currentRoom;
		if (roomId) {
			room = roomsStore.room(roomId);
		}
		const powerLevel = room?.getPowerLevel(user.userId) ?? 0;
		assert(powerLevel in roles, 'Powerlevel not one of the predefined powerlevels');
		return powerLevel;
	};

	const userRole = (roomId: string | undefined = undefined): TUserRole => {
		const powerLevel = userPowerLevel(roomId);
		if (userIsSuperAdmin()) return TUserRole.Administrator;
		if (powerLevel == roles.Admin) return TUserRole.Administrator;
		if (powerLevel == roles.SuperSteward) return TUserRole.SuperSteward;
		if (powerLevel == roles.Steward) return TUserRole.Steward;
		if (powerLevel == roles.Expert) return TUserRole.Expert;
		return TUserRole.User;
	};

	const userHasRole = (role: TUserRole, roomId: string | undefined = undefined): boolean => {
		assert(role in roles, 'Given role not a defined role');
		return role === userRole(roomId);
	};

	const userIsSuperAdmin = (): boolean => {
		return userStore.isAdmin;
	};

	const userIsAdmin = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(TUserRole.Administrator, roomId);
	};

	const userIsSuperSteward = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(TUserRole.SuperSteward, roomId);
	};

	const userIsSteward = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(TUserRole.Steward, roomId);
	};

	const userIsUser = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(TUserRole.User, roomId);
	};

	const accessForRoles = (roles: Array<TUserRole>, roomId: string | undefined = undefined): boolean => {
		return roles.includes(userRole(roomId));
	};

	return {
		currentRoomId,
		userIsSuperAdmin,
		userIsAdmin,
		userIsSuperSteward,
		userIsSteward,
		userIsUser,
		accessForRoles,
	};
}
export { useRoles };
