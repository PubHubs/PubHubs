// Packages
import { EventType } from 'matrix-js-sdk';
import { type Ref, computed, ref, watch } from 'vue';

// Logic
import { APIService } from '@hub-client/logic/core/apiService';

// Models
import { DirectRooms, type RoomListRoom, type RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { type TUserJoinedRooms, UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

export function useUserRooms(userId: Ref<string>, isAdmin: Ref<boolean>) {
	const user = useUser();
	const rooms = useRooms();
	const currentUserId = computed(() => user.userId);
	const targetUserJoinedRooms = ref<Set<string>>(new Set());

	watch(
		[userId, isAdmin],
		async ([newUserId, newIsAdmin]) => {
			if (!newUserId || !newIsAdmin) {
				targetUserJoinedRooms.value = new Set();
				return;
			}
			try {
				const result: TUserJoinedRooms = await APIService.adminListJoinedRoomId(newUserId);
				targetUserJoinedRooms.value = new Set(result.joined_rooms);
			} catch {
				targetUserJoinedRooms.value = new Set();
			}
		},
		{ immediate: true },
	);

	const visibleRooms = computed(() => {
		const selectedUserId = userId.value;
		const currentUserIdVal = currentUserId.value;
		if (!selectedUserId || !currentUserIdVal) return [];

		// Build O(1) lookup maps once per computation
		const roomListById = new Map<string, RoomListRoom>();
		for (const entry of rooms.roomList) {
			roomListById.set(entry.roomId, entry);
		}
		const nameById = new Map<string, string>();
		for (const r of rooms.publicRooms) {
			if (r.name) nameById.set(r.room_id, r.name);
		}
		for (const r of rooms.securedRooms) {
			const n = (r as Record<string, unknown>).room_name ?? r.name;
			if (n) nameById.set(r.room_id, String(n));
		}
		for (const entry of rooms.roomList) {
			if (entry.name) nameById.set(entry.roomId, entry.name);
		}

		function isMember(roomId: string, uid: string): boolean {
			const roomObj = rooms.room(roomId);
			if (roomObj?.getMember(uid)) return true;
			const entry = roomListById.get(roomId);
			if (!entry) return false;
			return entry.stateEvents.some((e) => e.type === 'm.room.member' && e.state_key === uid && e.content?.membership === 'join');
		}

		function getRoomName(roomId: string): string {
			const roomObj = rooms.room(roomId);
			if (roomObj?.name) return roomObj.name;
			return nameById.get(roomId) ?? roomId;
		}

		const result: Array<{ roomId: string; name: string }> = [];
		const addedRoomIds = new Set<string>();

		function addRoom(roomId: string) {
			if (!addedRoomIds.has(roomId)) {
				addedRoomIds.add(roomId);
				result.push({ roomId, name: getRoomName(roomId) });
			}
		}

		function isDirectRoom(roomId: string): boolean {
			const entry = roomListById.get(roomId);
			if (entry && DirectRooms.includes(entry.roomType as RoomType)) return true;
			const roomObj = rooms.room(roomId);
			if (roomObj) {
				const type = roomObj.getType();
				if (type && DirectRooms.includes(type as RoomType)) return true;
			}
			const publicRoom = rooms.publicRooms.find((r) => r.room_id === roomId);
			if (publicRoom?.room_type && DirectRooms.includes(publicRoom.room_type as RoomType)) return true;
			return false;
		}

		if (isAdmin.value) {
			for (const roomId of targetUserJoinedRooms.value) {
				if (!isDirectRoom(roomId)) addRoom(roomId);
			}
		} else {
			for (const publicRoom of rooms.publicRooms) {
				if (isMember(publicRoom.room_id, selectedUserId)) {
					addRoom(publicRoom.room_id);
				}
			}
			for (const entry of rooms.roomList) {
				if (DirectRooms.includes(entry.roomType as RoomType)) continue;

				const plEvent = entry.stateEvents.find((e) => e.type === EventType.RoomPowerLevels && e.content?.users);
				let currentUserPower = UserPowerLevel.User;
				if (plEvent) {
					currentUserPower =
						(plEvent.content.users as Record<string, number>)[currentUserIdVal] ??
						(plEvent.content.users_default as number | undefined) ??
						UserPowerLevel.User;
				}
				if (currentUserPower < UserPowerLevel.Steward) continue;

				if (isMember(entry.roomId, selectedUserId)) {
					addRoom(entry.roomId);
				}
			}
		}

		return result.sort((a, b) => a.name.localeCompare(b.name));
	});

	return { visibleRooms, targetUserJoinedRooms };
}
