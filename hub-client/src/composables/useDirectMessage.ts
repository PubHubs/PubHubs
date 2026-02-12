// Packages
import { computed } from 'vue';

// Composables
import { useSidebar } from '@hub-client/composables/useSidebar';

// Logic
import { router } from '@hub-client/logic/core/router';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { Room, useRooms } from '@hub-client/stores/rooms';
import { useSettings } from '@hub-client/stores/settings';
import { User, useUser } from '@hub-client/stores/user';

// Types
import { MatrixUser } from '@hub-client/types/types';

export function useDirectMessage() {
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const user = useUser();
	const sidebar = useSidebar();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	/**
	 * Navigate to a DM room that's already loaded in the store.
	 * Handles mobile (sidebar) vs desktop (direct selection) differently.
	 */
	function goToRoom(room: Room) {
		sidebar.openDMRoom(room);
		router.push({ name: 'direct-msg' });
	}

	/**
	 * Open a DM with a user by their userId.
	 * Creates the room if it doesn't exist, or opens the existing one.
	 */
	async function goToUserDM(userId: string): Promise<void> {
		const otherUser = user.client?.getUser(userId);
		if (!otherUser || user.userId === otherUser.userId) return;

		const result = await pubhubs.createPrivateRoomWith(otherUser as User);
		if (result) {
			// Ensure room is loaded in store (might be an existing room that wasn't loaded yet)
			await rooms.joinRoomListRoom(result.room_id);
			const storeRoom = rooms.rooms[result.room_id];
			if (storeRoom) {
				goToRoom(storeRoom);
			}
		}
	}

	/**
	 * Create a DM room with one or more users and navigate to it.
	 * For single user, creates a 1:1 DM. For multiple users, creates a group DM.
	 */
	async function createDMWithUsers(users: User | MatrixUser[]): Promise<Room | null> {
		const result = await pubhubs.createPrivateRoomWith(users);
		if (result) {
			// Ensure room is loaded in store
			await rooms.joinRoomListRoom(result.room_id);
			const storeRoom = rooms.rooms[result.room_id];
			if (storeRoom) {
				sidebar.openDMRoom(storeRoom);
				return storeRoom;
			}
		}
		return null;
	}

	/**
	 * Create a DM room with users and navigate to it.
	 * Similar to createDMWithUsers but also handles navigation.
	 */
	async function createAndGoToDM(users: User | MatrixUser[]): Promise<void> {
		const room = await createDMWithUsers(users);
		if (room) {
			router.push({ name: 'direct-msg' });
		}
	}

	/**
	 * Create a steward contact room for a specific room and navigate to it.
	 */
	async function goToStewardRoom(roomId: string, members: MatrixUser[]): Promise<void> {
		const result = await pubhubs.createPrivateRoomWith(members, false, true, roomId);
		if (result) {
			await rooms.joinRoomListRoom(result.room_id);
			const storeRoom = rooms.rooms[result.room_id];
			if (storeRoom) {
				goToRoom(storeRoom);
			}
		}
	}

	return {
		isMobile,
		goToRoom,
		goToUserDM,
		createDMWithUsers,
		createAndGoToDM,
		goToStewardRoom,
	};
}
