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

	function goToRoom(room: Room) {
		sidebar.openDMRoom(room);
		router.push({ name: 'direct-msg' });
	}

	/** Opens or creates a 1:1 DM with the given user and navigates to it. */
	async function goToUserDM(userId: string): Promise<void> {
		const otherUser = user.client?.getUser(userId);
		if (!otherUser || user.userId === otherUser.userId) return;

		const result = await pubhubs.createPrivateRoomWith(otherUser as User);
		if (result) {
			await rooms.joinRoomListRoom(result.room_id);
			const storeRoom = rooms.rooms[result.room_id];
			if (storeRoom) {
				goToRoom(storeRoom);
			}
		}
	}

	/** Creates a DM (1:1 or group) and selects it in the sidebar. */
	async function createDMWithUsers(users: User | MatrixUser[]): Promise<Room | null> {
		const result = await pubhubs.createPrivateRoomWith(users);
		if (result) {
			await rooms.joinRoomListRoom(result.room_id);
			const storeRoom = rooms.rooms[result.room_id];
			if (storeRoom) {
				sidebar.openDMRoom(storeRoom);
				return storeRoom;
			}
		}
		return null;
	}

	/** Creates a DM and navigates to the DM page. */
	async function createAndGoToDM(users: User | MatrixUser[]): Promise<void> {
		const room = await createDMWithUsers(users);
		if (room) {
			router.push({ name: 'direct-msg' });
		}
	}

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
