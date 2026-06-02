// Packages
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

// Composables
import { useRoles } from '@hub-client/composables/roles.composable';
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

// Logic
import { APIService } from '@hub-client/logic/core/apiHubManagement';
import { router } from '@hub-client/logic/core/router';

// Models
import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { DirectRooms, type RoomType, type TBaseRoom } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useDialog } from '@hub-client/stores/dialog';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { type TPublicRoom, type TSecuredRoom, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

export function useManageRooms() {
	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const sidebar = useSidebar();
	const route = useRoute();
	const { userPowerLevel } = useRoles();

	const showPastMemberPanel = ref(false);
	const currentRoomId = ref('');
	const selectedRoomId = ref<string>();
	const selectedRoomName = ref<string>();

	const isAdmin = computed(() => user.isAdministrator);

	const selectedRoomIsAdmin = computed(() => {
		if (!selectedRoomId.value) return false;
		return userPowerLevel(selectedRoomId.value) >= UserPowerLevel.Steward;
	});

	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	onMounted(async () => {
		await rooms.fetchPublicRooms(true);
		if (isAdmin.value) {
			try {
				await rooms.fetchSecuredRooms();
			} catch {
				// Stewards can't list secured rooms via this endpoint; use roomList instead
			}
		}
	});

	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				selectedRoomId.value = undefined;
			}
		},
	);

	watch(
		() => route.query.roomId,
		async (roomId) => {
			if (!roomId || typeof roomId !== 'string') return;
			const roomName = rooms.room(roomId)?.name ?? rooms.roomList.find((r) => r.roomId === roomId)?.name ?? roomId;
			selectRoom(roomId, roomName);
		},
		{ immediate: true },
	);

	const nonSecuredPublicRooms = computed(() => rooms.nonSecuredPublicRooms);
	const sortedSecuredRooms = computed(() => rooms.sortedSecuredRooms);

	const allRoomsWithType = computed(() => {
		const publicRooms = nonSecuredPublicRooms.value.map((r) => ({ ...r, _roomType: 'public' }));
		const securedRooms = sortedSecuredRooms.value.map((r) => ({ ...r, _roomType: 'secured' }));
		const allRooms = [...publicRooms, ...securedRooms];
		if (isAdmin.value) return allRooms;

		const existingIds = new Set(allRooms.map((r) => r.room_id));
		// Also include rooms from the joined room list that aren't in the directory/API
		for (const entry of rooms.roomList) {
			if (DirectRooms.includes(entry.roomType as RoomType)) continue;
			if (existingIds.has(entry.roomId)) continue;
			existingIds.add(entry.roomId);
			allRooms.push({
				room_id: entry.roomId,
				name: entry.name,
				room_type: entry.roomType,
				_roomType: entry.roomType === 'ph.messages.restricted' ? 'secured' : 'public',
			} as TBaseRoom & { _roomType: string });
		}
		// Filter to rooms where the user has steward+ level
		return allRooms.filter((r) => userPowerLevel(r.room_id) >= UserPowerLevel.Steward);
	});

	const roomTypeFilters = computed(() => [
		{ label: t('admin.public_rooms'), predicate: (item: Record<string, unknown>) => (item as { _roomType?: string })._roomType === 'public' },
		{ label: t('admin.secured_rooms'), predicate: (item: Record<string, unknown>) => (item as { _roomType?: string })._roomType === 'secured' },
	]);

	function newPublicRoom() {
		router.push({ name: 'editroom', params: { id: 'new_room' } });
	}

	async function removePublicRoom(room: TPublicRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.remove_room_sure'))) {
			try {
				await rooms.removePublicRoom(room.room_id);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function removeSecuredRoom(room: TSecuredRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.secured_remove_sure'))) {
			try {
				await rooms.removeSecuredRoom(room);
				// If the room was secured, we need to remove the members from the allowed_to_join_room table
				rooms.kickUsersFromSecuredRoom(room.room_id);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function makeRoomAdmin(roomId: string, userId: string): Promise<void | Error> {
		const dialog = useDialog();
		// If the user presses cancel, then don't proceed!
		const okCancelStatus = await dialog.okcancel(t('admin.make_admin'));
		if (!okCancelStatus) return;

		try {
			await APIService.makeRoomAdmin(roomId, userId);
		} catch {
			const roomCreator = await ManagementUtils.getRoomCreator(roomId);
			if (roomCreator === user.userId) {
				await pubhubs.joinRoom(roomId);
				return;
			}

			// This will happen in case of abandon room i.e., rooms without room admin.
			const isMember = await ManagementUtils.roomCreatorIsMember(roomId);
			// Creator is not a member of the room, so we show past admin to join.
			if (!isMember) {
				showPastMemberPanel.value = true;
				currentRoomId.value = roomId;
				return;
			}
		}
		await pubhubs.joinRoom(roomId);
	}

	function itemRoomId(item: Record<string, unknown>): string {
		return (item.room_id as string) ?? '';
	}

	function closeForm() {
		showPastMemberPanel.value = false;
	}

	function findSelectedRoom(): TPublicRoom | TSecuredRoom | undefined {
		const publicRoom = nonSecuredPublicRooms.value.find((r) => r.room_id === selectedRoomId.value);
		if (publicRoom) return publicRoom;
		return sortedSecuredRooms.value.find((r) => r.room_id === selectedRoomId.value);
	}

	function editSelectedRoom() {
		if (!selectedRoomId.value) return;
		router.push({ name: 'editroom', params: { id: selectedRoomId.value } });
	}

	function removeSelectedRoom() {
		const room = findSelectedRoom();
		if (!room) return;
		if (nonSecuredPublicRooms.value.find((r) => r.room_id === selectedRoomId.value)) {
			removePublicRoom(room as TPublicRoom);
		} else {
			removeSecuredRoom(room as TSecuredRoom);
		}
	}

	function promoteSelectedRoom() {
		if (selectedRoomId.value) {
			makeRoomAdmin(selectedRoomId.value, user.userId ?? '');
		}
	}

	function goToSelectedRoom() {
		if (!selectedRoomId.value) return;
		router.push({ name: 'room', params: { id: selectedRoomId.value } });
	}

	function navigateToUser(userId: string) {
		router.push({ name: 'manage-users', query: { userId } });
	}

	function selectRoom(roomId: string, roomName: string) {
		if (sidebar.activeTab.value === SidebarTab.ManageRoom && selectedRoomId.value === roomId) {
			sidebar.close();
			return;
		}
		selectedRoomId.value = roomId;
		selectedRoomName.value = roomName;
		sidebar.openTab(SidebarTab.ManageRoom);
	}

	return {
		showPastMemberPanel,
		currentRoomId,
		selectedRoomId,
		selectedRoomName,
		isAdmin,
		selectedRoomIsAdmin,
		allRoomsWithType,
		roomTypeFilters,
		nonSecuredPublicRooms,
		sortedSecuredRooms,
		newPublicRoom,
		editSelectedRoom,
		removeSelectedRoom,
		promoteSelectedRoom,
		goToSelectedRoom,
		navigateToUser,
		selectRoom,
		closeForm,
		itemRoomId,
	};
}
