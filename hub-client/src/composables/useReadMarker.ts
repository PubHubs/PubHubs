import { computed, onBeforeUnmount, ref } from 'vue';

import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';

import type Room from '@hub-client/models/rooms/Room';

export function useReadMarker(room: Room) {
	const { getLastReadMessage, setLastReadMessage } = useLastReadMessages();
	const displayedReadMarker = ref<string | null>(null);

	function initialize() {
		const lastRead = getLastReadMessage(room.roomId);
		if (lastRead) {
			displayedReadMarker.value = lastRead.eventId;
			room.setLastVisibleEventId(lastRead.eventId);
			room.setLastVisibleTimeStamp(lastRead.timestamp);
		}
	}

	function update(eventId: string, timestamp: number) {
		if (timestamp <= room.getLastVisibleTimeStamp()) {
			return;
		}

		room.setLastVisibleEventId(eventId);
		room.setLastVisibleTimeStamp(timestamp);
		setLastReadMessage(room.roomId, eventId, timestamp);
	}

	function persist() {
		const lastVisibleEventId = room.getLastVisibleEventId();
		const lastVisibleTimestamp = room.getLastVisibleTimeStamp();

		if (lastVisibleEventId && lastVisibleTimestamp > 0) {
			setLastReadMessage(room.roomId, lastVisibleEventId, lastVisibleTimestamp);
		}
	}

	onBeforeUnmount(() => {
		persist();
	});

	return {
		displayedReadMarker: computed(() => displayedReadMarker.value),
		initialize,
		update,
		persist,
	};
}
