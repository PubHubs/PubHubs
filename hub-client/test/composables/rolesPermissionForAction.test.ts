import { describe, expect, test, vi } from 'vitest';

import { useRoles } from '@hub-client/composables/roles.composable';

import { UserAction, UserPowerLevel } from '@hub-client/models/users/TUser';

const state = vi.hoisted(() => ({ isHubAdmin: false, roomPowerLevel: 0 }));

vi.mock('@hub-client/composables/usePowerLevels', () => ({
	usePowerLevels: () => ({ powerLevel: () => state.roomPowerLevel, maxRoomPowerLevel: () => state.roomPowerLevel }),
}));
vi.mock('@hub-client/stores/user', () => ({
	useUser: () => ({
		get isAdmin() {
			return state.isHubAdmin;
		},
	}),
}));
vi.mock('@hub-client/stores/rooms', () => ({ useRooms: () => ({ currentRoom: { roomId: '!current:hub' } }) }));

const ROOM = '!room:hub';

describe('userHasPermissionForAction', () => {
	test('a hub admin without rights in the room cannot moderate there', () => {
		state.isHubAdmin = true;
		state.roomPowerLevel = UserPowerLevel.User;
		const roles = useRoles();
		expect(roles.userHasPermissionForAction(UserAction.Kick, ROOM)).toBe(false);
		expect(roles.userHasPermissionForAction(UserAction.Ban, ROOM)).toBe(false);
		expect(roles.userHasPermissionForAction(UserAction.Timeout, ROOM)).toBe(false);
	});

	test('a steward in the room can moderate there, hub admin or not', () => {
		for (const isHubAdmin of [false, true]) {
			state.isHubAdmin = isHubAdmin;
			state.roomPowerLevel = UserPowerLevel.Steward;
			const roles = useRoles();
			expect(roles.userHasPermissionForAction(UserAction.Kick, ROOM)).toBe(true);
			expect(roles.userHasPermissionForAction(UserAction.Ban, ROOM)).toBe(true);
		}
	});

	test('the hub admin role still counts where a role is asked for', () => {
		state.isHubAdmin = true;
		state.roomPowerLevel = UserPowerLevel.User;
		expect(useRoles().userIsHubAdmin()).toBe(true);
	});
});
