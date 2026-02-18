import { assert } from 'chai';

import { UserAction, UserPowerLevel, UserRole, UserRoleActions } from '@hub-client/models/users/TUser';

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
		assert(powerLevel in UserPowerLevel, 'Powerlevel not one of the predefined powerlevels');
		return powerLevel;
	};

	const getRoleByPowerLevel = (powerLevel: number): UserRole => {
		if (powerLevel == UserPowerLevel.Admin) return UserRole.Admin;
		if (powerLevel >= UserPowerLevel.SuperSteward) return UserRole.SuperSteward;
		if (powerLevel >= UserPowerLevel.Steward) return UserRole.Steward;
		if (powerLevel >= UserPowerLevel.Expert) return UserRole.Expert;
		return UserRole.User;
	};

	const userRole = (roomId: string | undefined = undefined): UserRole => {
		if (userIsSuperAdmin()) return UserRole.Admin;
		const powerLevel = userPowerLevel(roomId);
		return getRoleByPowerLevel(powerLevel);
	};

	const userHasRole = (role: UserRole, roomId: string | undefined = undefined): boolean => {
		assert(role in UserRole, 'Given role not a defined role');
		return role === userRole(roomId);
	};

	const userIsSuperAdmin = (): boolean => {
		return userStore.isAdmin;
	};

	const userIsAdmin = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(UserRole.Admin, roomId);
	};

	const userIsSuperSteward = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(UserRole.SuperSteward, roomId);
	};

	const userIsSteward = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(UserRole.Steward, roomId);
	};

	const userIsUser = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(UserRole.User, roomId);
	};

	const userHasAccessForRoles = (roles: Array<UserRole>, roomId: string | undefined = undefined): boolean => {
		return roles.includes(userRole(roomId));
	};

	const userHasPermissionForAction = (action: UserAction, roomId: string | undefined = undefined): boolean => {
		assert(action in UserAction, 'Given action not a defined action');
		const role = userRole(roomId);
		return UserRoleActions[role].includes(action);
	};

	return {
		currentRoomId,
		getRoleByPowerLevel,
		userIsSuperAdmin,
		userIsAdmin,
		userIsSuperSteward,
		userIsSteward,
		userIsUser,
		userHasAccessForRoles,
		userHasPermissionForAction,
	};
}
export { useRoles };
