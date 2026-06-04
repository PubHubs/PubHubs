// Packages
import { type Ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

// Logic
import { getRoomMembers } from '@hub-client/logic/utils/roomUtils';

// Models
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';
import { useYivi } from '@hub-client/stores/yivi';

// Types
export interface RoomSteward {
	userId: string;
	roomId: string;
	powerLevel: number;
	displayName: string;
}

export function useRoomDetails(roomId: Ref<string>) {
	const rooms = useRooms();
	const user = useUser();
	const yiviStore = useYivi();
	const { t } = useI18n();

	const matrixRoom = computed(() => (roomId.value ? rooms.room(roomId.value) : undefined));
	const publicRoom = computed(() => (roomId.value ? rooms.getPublicRoom(roomId.value) : undefined));
	const securedRoom = computed(() => (roomId.value ? rooms.securedRoomById(roomId.value) : undefined));

	const roomCategory = computed<'public' | 'secured' | undefined>(() => {
		if (publicRoom.value) return 'public';
		if (securedRoom.value) return 'secured';
		return undefined;
	});

	const memberCount = computed<number | undefined>(() => {
		const ids = allMemberIds.value;
		return ids.length > 0 ? ids.length : undefined;
	});

	const roomTypeDisplay = computed(() => {
		if (!roomCategory.value) return '';

		const prefixKey = roomCategory.value === 'secured' ? 'rooms.room_type_prefix_secured' : 'rooms.room_type_prefix_public';
		const roomTypeValue = publicRoom.value?.room_type ?? securedRoom.value?.room_type ?? '';
		const suffixKey = roomTypeValue === 'ph.forum-room' ? 'rooms.room_type_suffix_forum' : 'rooms.room_type_suffix_default';

		return `${t(prefixKey)} ${t(suffixKey)}`;
	});

	const roomTopic = computed(() => {
		const topic = rooms.getRoomTopic(roomId.value);
		if (topic) return topic;
		const apiTopic = publicRoom.value?.topic ?? securedRoom.value?.topic;
		if (apiTopic) return apiTopic;
		return '-';
	});

	const yiviAttributeNames = computed(() => {
		const attrs = securedRoom.value?.accepted;
		if (!attrs) return [];
		const yiviAttrs = yiviStore.getAttributes(t);
		return Object.keys(attrs).map((key) => {
			const found = yiviAttrs.find((a) => a.attribute === key);
			return found ? found.label : key;
		});
	});

	const roomListEntry = computed(() => rooms.roomList.find((r) => r.roomId === roomId.value));

	const hasRoomData = computed(
		() => !!matrixRoom.value || (!!roomListEntry.value && roomListEntry.value.stateEvents.length > 0) || !!publicRoom.value || !!securedRoom.value,
	);

	const allMemberIds = computed<string[]>(() => {
		if (!roomId.value) return [];
		if (matrixRoom.value) {
			return getRoomMembers(matrixRoom.value);
		}
		const entry = roomListEntry.value;
		if (!entry?.stateEvents) return [];
		return entry.stateEvents
			.filter((e) => e.type === 'm.room.member' && e.content?.membership === 'join')
			.map((e) => e.state_key)
			.filter((id) => !id.startsWith('@notices_user:'));
	});

	const powerLevels = computed<Record<string, number> | null>(() => {
		if (!roomId.value) return null;
		if (matrixRoom.value) {
			const state = matrixRoom.value.getStatePowerLevel();
			if (state?.content?.users) return state.content.users as Record<string, number>;
			return null;
		}
		const entry = roomListEntry.value;
		if (entry?.stateEvents) {
			const event = entry.stateEvents.find((e) => e.type === 'm.room.power_levels' && e.content?.users);
			if (event) return event.content.users as Record<string, number>;
		}
		return null;
	});

	const powerUsers = computed<RoomSteward[]>(() => {
		if (!roomId.value) return [];
		const levels = powerLevels.value;
		const members = allMemberIds.value;
		if (!levels) return [];

		return Object.entries(levels)
			.filter(([uid]) => !uid.startsWith('@notices_user:'))
			.filter(([uid]) => members.includes(uid))
			.filter(([, level]) => level >= UserPowerLevel.Steward)
			.map(([uid, powerLevel]) => ({
				userId: uid,
				roomId: roomId.value ?? '',
				powerLevel,
				displayName: user.userDisplayName(uid) ?? uid,
			}));
	});

	const combinedStewards = computed(() => [...powerUsers.value].sort((a, b) => b.powerLevel - a.powerLevel));
	const nonPowerMemberIds = computed(() => allMemberIds.value.filter((id) => !powerUsers.value.some((u) => u.userId === id)));

	return {
		matrixRoom,
		publicRoom,
		securedRoom,
		roomCategory,
		memberCount,
		roomTypeDisplay,
		roomTopic,
		yiviAttributeNames,
		roomListEntry,
		hasRoomData,
		allMemberIds,
		powerLevels,
		powerUsers,
		combinedStewards,
		nonPowerMemberIds,
	};
}
