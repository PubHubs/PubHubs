import { computed, ref, watch } from 'vue';

import { useModeration } from '@hub-client/composables/moderation.composable';

import type Room from '@hub-client/models/rooms/Room';

import { type TPublicRoom, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Types
type MentionAutoCompleteProps = {
	msg?: string;
	left: number;
	top: number;
	room: Room;
};

type UserDetails = { userId: string; displayName?: string };

function useMentionAutocomplete(msg: () => string | undefined, room: () => Room) {
	const userStore = useUser();
	const roomsStore = useRooms();
	const { allMembers } = useModeration();
	const mentionDismissed = ref(false);

	const marker = computed<'@' | '#' | null>(() => {
		const m = msg() || '';
		const lastAt = m.lastIndexOf('@');
		const lastHash = m.lastIndexOf('#');
		if (lastAt > lastHash && lastAt !== -1) return '@';
		if (lastHash > lastAt && lastHash !== -1) return '#';
		return null;
	});

	const positionOfMarker = computed<number>(() => {
		if (!marker.value) return 0;
		const m = msg();
		if (m?.includes(marker.value)) {
			if (m?.endsWith(marker.value)) return m.length;
			if ((m?.length ?? 0) < positionOfMarker.value && positionOfMarker.value > 0) return 0;
		}
		return 0;
	});

	const items = computed<(UserDetails | TPublicRoom)[]>(() => {
		switch (marker.value) {
			case '@':
				return allMembers.value.map(
					(userId) =>
						({
							userId,
							displayName: userStore.userDisplayName(userId),
						}) as UserDetails,
				);
			case '#':
				return roomsStore.publicRooms.filter((r) => r.room_id !== room().roomId);
			default:
				return [];
		}
	});

	const filteredItems = computed(() => {
		if (!marker.value) return [];
		const query = msg() ?? '';
		return query.endsWith(marker.value) ? items.value : filterItems(query);
	});

	function filterItems(query: string): UserDetails[] | TPublicRoom[] {
		if (!marker.value) return [];
		const searchTerm = query.slice(query.lastIndexOf(marker.value) + 1).toLowerCase();
		switch (marker.value) {
			case '@':
				return (items.value as UserDetails[]).filter(
					(user) => user.displayName?.toLowerCase().includes(searchTerm) || user.userId.toLowerCase().includes(searchTerm),
				);
			case '#':
				return (items.value as TPublicRoom[]).filter((r) => r.name?.toLowerCase().includes(searchTerm) || r.topic?.toLowerCase().includes(searchTerm));
			default:
				return [];
		}
	}

	const isVisible = computed<boolean>(() => {
		if (mentionDismissed.value || !marker.value) return false;
		const m = msg();
		if (m?.includes(marker.value)) {
			if (m?.endsWith(marker.value)) return true;
			if ((m?.length ?? 0) < positionOfMarker.value && positionOfMarker.value > 0) return false;
			if (filteredItems.value.length > 0) return true;
		}
		return false;
	});

	const selectItem = (item: UserDetails | TPublicRoom) => {
		mentionDismissed.value = true;
		return { item, marker: marker.value };
	};

	const shortId = (id: string): string | null => {
		const result = /([^:]+):/.exec(id);
		return result ? result[1] : null;
	};

	const getDisplayName = (item: UserDetails | TPublicRoom): string => {
		if (marker.value === '@') return (item as UserDetails).displayName || '';
		if (marker.value === '#') return (item as TPublicRoom).name || '';
		return '';
	};

	const getId = (item: UserDetails | TPublicRoom): string => {
		if (marker.value === '@') return (item as UserDetails).userId || '';
		if (marker.value === '#') return (item as TPublicRoom).room_id || '';
		return '';
	};

	const isUser = (item: UserDetails | TPublicRoom): item is UserDetails => {
		return 'userId' in item;
	};

	watch(msg, () => {
		mentionDismissed.value = false;
	});

	return { marker, isVisible, filteredItems, selectItem, shortId, getDisplayName, getId, isUser };
}
export { useMentionAutocomplete, UserDetails, MentionAutoCompleteProps };
