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
		const currentUser = userStore.user;
		let room = roomsStore.currentRoom;
		if (roomId) {
			room = roomsStore.room(roomId);
		}
		if (room) {
			const powerLevel = room.getStateMemberPowerLevel(currentUser.userId) ?? 0;
			assert(powerLevel in UserPowerLevel, 'Powerlevel not one of the predefined powerlevels');
			return powerLevel;
		}
		// Fallback to roomList state events (rooms from sliding sync not yet joined)
		if (roomId && currentUser.userId) {
			const listEntry = roomsStore.roomList.find((r) => r.roomId === roomId);
			if (listEntry?.stateEvents) {
				const event = listEntry.stateEvents.find((e) => e.type === 'm.room.power_levels' && e.content?.users);
				if (event) {
					return event.content.users[currentUser.userId] ?? event.content.users_default ?? 0;
				}
			}
		}
		return 0;
	};

	const getRoleByPowerLevel = (powerLevel: number): UserRole => {
		if (powerLevel === UserPowerLevel.Admin) return UserRole.Admin;
		if (powerLevel >= UserPowerLevel.SuperSteward) return UserRole.SuperSteward;
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
	const userIsSuperStewardOrHigher = (roomId?: string) => userHasRoleOrHigher(UserRole.SuperSteward, roomId);
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
		return roomsStore.userMaxRoomPowerLevel;
	};

	const userHasHubRoleOrHigher = (role: UserRole): boolean => userHubPowerLevel() >= UserPowerLevel[role];

	const userIsHubStewardOrHigher = (): boolean => userHasHubRoleOrHigher(UserRole.Steward);

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
		userPowerLevel,
		userIsHubAdmin,
		userIsAdmin,
		userIsSuperSteward,
		userIsSteward,
		userIsUser,
		userHasAccessForRoles,
		userHasPermissionForAction,
		userIsStewardOrHigher,
		userIsExpertOrHigher,
		userIsSuperStewardOrHigher,
		userIsAdminOrHigher,
		userHubPowerLevel,
		userHasHubRoleOrHigher,
		userIsHubStewardOrHigher,
	};
}
export { useRoles };
