import { usePowerLevels } from '@hub-client/composables/usePowerLevels';

import { assert } from '@hub-client/logic/utils/assert';

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
	const powerLevels = usePowerLevels();

	const currentRoomId = (): string | undefined => {
		const room = roomsStore.currentRoom;
		if (!room) return undefined;
		return room.roomId;
	};

	/**
	 * Power level of the current user in the given room, or in the current room when none is given.
	 */
	const userPowerLevel = (roomId: string | undefined = undefined): number => {
		const id = roomId ?? currentRoomId();
		if (!id) return UserPowerLevel.User;
		return powerLevels.powerLevel(id);
	};

	const getRoleByPowerLevel = (powerLevel: number): UserRole => {
		if (powerLevel === UserPowerLevel.Admin) return UserRole.Admin;
		if (powerLevel >= UserPowerLevel.Steward) return UserRole.Steward;
		if (powerLevel >= UserPowerLevel.Expert) return UserRole.Expert;
		return UserRole.User;
	};

	const userRole = (roomId: string | undefined = undefined): UserRole => {
		if (userIsHubAdmin()) return UserRole.Admin;
		const powerLevel = userPowerLevel(roomId);
		return getRoleByPowerLevel(powerLevel);
	};

	const userHasRoleOrHigher = (role: UserRole, roomId: string | undefined = undefined): boolean => {
		assert(role in UserRole, 'Given role not a defined role');
		const currentPowerLevel = userPowerLevel(roomId);
		const thresholdPowerLevel = UserPowerLevel[role];
		return currentPowerLevel >= thresholdPowerLevel;
	};

	const userIsAdminOrHigher = (roomId?: string) => userHasRoleOrHigher(UserRole.Admin, roomId);
	const userIsStewardOrHigher = (roomId?: string) => userHasRoleOrHigher(UserRole.Steward, roomId);
	const userIsExpertOrHigher = (roomId?: string) => userHasRoleOrHigher(UserRole.Expert, roomId);

	const userHasRole = (role: UserRole, roomId: string | undefined = undefined): boolean => {
		assert(role in UserRole, 'Given role not a defined role');
		return role === userRole(roomId);
	};

	// For hub-wide moderation checks prefer userIsHubStewardOrHigher over this Synapse-admin-only flag.
	const userIsHubAdmin = (): boolean => {
		return userStore.isAdmin;
	};

	/** Effective hub-wide power level: Synapse admins are treated as Admin, everyone else uses their highest matrix power level. */
	const userHubPowerLevel = (): number => {
		if (userStore.isAdmin) return UserPowerLevel.Admin;
		return powerLevels.maxRoomPowerLevel();
	};

	const userHasHubRoleOrHigher = (role: UserRole): boolean => userHubPowerLevel() >= UserPowerLevel[role];

	const userIsHubStewardOrHigher = (): boolean => userHasHubRoleOrHigher(UserRole.Steward);

	const userIsAdmin = (roomId: string | undefined = undefined): boolean => {
		return userHasRole(UserRole.Admin, roomId);
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
		userPowerLevel,
		userIsHubAdmin,
		userIsAdmin,
		userIsSteward,
		userIsUser,
		userHasAccessForRoles,
		userHasPermissionForAction,
		userIsStewardOrHigher,
		userIsExpertOrHigher,
		userIsAdminOrHigher,
		userHubPowerLevel,
		userHasHubRoleOrHigher,
		userIsHubStewardOrHigher,
	};
}
export { useRoles };
