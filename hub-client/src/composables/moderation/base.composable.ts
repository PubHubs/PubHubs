import { type Ref, computed, unref } from 'vue';

import { getRoomMembers } from '@hub-client/logic/utils/roomUtils';

import { type RoomMemberStateEvent } from '@hub-client/models/rooms/RoomMember';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { type Room, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Types
type TPowerUser = {
	userId: string;
	roomId: string;
	powerLevel: number;
	displayName: string;
};

function useModerationBase(room?: Ref<Room | undefined> | Room) {
	// Stores
	const userStore = useUser();
	const roomStore = useRooms();

	// Helpers
	const getCurrentRoom = () => unref(room) ?? roomStore.currentRoom;

	// Computed
	const allMembers = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return getRoomMembers(currentRoom);
	});

	const powerMembers = computed((): TPowerUser[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];

		const state = currentRoom.getStatePowerLevel();
		if (!state) return [];

		return Object.entries(state.content.users as Record<string, number>).reduce((acc, [userId, powerLevel]) => {
			if (userId.startsWith('@notices_user:')) return acc;

			const user: TPowerUser = {
				userId,
				roomId: currentRoom.roomId,
				powerLevel,
				displayName: userStore.userDisplayName(userId) ?? userId,
			};

			if (powerLevel >= UserPowerLevel.Steward && allMembers.value.includes(user.userId)) acc.push(user);

			return acc;
		}, [] as TPowerUser[]);
	});

	const nonPowerMemberIds = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		if (currentRoom.isDirectMessageRoom() && !currentRoom.isGroupRoom()) return [...new Set(allMembers.value)];

		const powerUserIds = powerMembers.value.map((user) => user.userId);

		return allMembers.value.filter((id) => !powerUserIds.includes(id));
	});

	const stewards = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Steward));

	const admins = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Admin));

	const membershipEvents = computed((): RoomMemberStateEvent[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return currentRoom.getStateMember();
	});

	return {
		// Helpers
		getCurrentRoom,
		// Computed
		allMembers,
		powerMembers,
		nonPowerMemberIds,
		stewards,
		admins,
		membershipEvents,
	};
}

export { TPowerUser, useModerationBase };
