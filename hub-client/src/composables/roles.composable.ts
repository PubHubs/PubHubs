import { assert } from 'chai';

import { TUserRole, UserAction, UserPowerLevel, roleActions } from '@hub-client/models/users/TUser';

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

	const getRoleByPowerLevel = (powerLevel: number): TUserRole => {
		if (powerLevel == UserPowerLevel.Admin) return TUserRole.Admin;
		if (powerLevel == UserPowerLevel.SuperSteward) return TUserRole.SuperSteward;
		if (powerLevel == UserPowerLevel.Steward) return TUserRole.Steward;
		if (powerLevel == UserPowerLevel.Expert) return TUserRole.Expert;
		if (powerLevel == UserPowerLevel.User) return TUserRole.User;
		return TUserRole.NoRole;
	};

	const userRole = (roomId: string | undefined = undefined): TUserRole => {
		if (userIsSuperAdmin()) return TUserRole.Admin;
		const powerLevel = userPowerLevel(roomId);
		return getRoleByPowerLevel(powerLevel);
	};

	const userHasRole = (role: TUserRole, roomId: string | undefined = undefined): boolean => {
		assert(role in TUserRole, 'Given role not a defined role');
		return role === userRole(roomId);
	};

	const userIsSuperAdmin = (): boolean => {
		return userStore.isAdmin;
	};

	const userIsAdmin = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(TUserRole.Admin, roomId);
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

	const userHasAccessForRoles = (roles: Array<TUserRole>, roomId: string | undefined = undefined): boolean => {
		return roles.includes(userRole(roomId));
	};

	const userHasPermissionForAction = (action: UserAction, roomId: string | undefined = undefined): boolean => {
		assert(action in UserAction, 'Given action not a defined action');
		const role = userRole(roomId);
		return roleActions[role].includes(action);
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
