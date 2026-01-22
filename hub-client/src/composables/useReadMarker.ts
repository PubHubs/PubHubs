import { computed, onBeforeUnmount, ref } from 'vue';

import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';

import type Room from '@hub-client/models/rooms/Room';

export function useReadMarker(room: Room) {
	const { getLastReadMessage, setLastReadMessage } = useLastReadMessages();
	const displayedReadMarker = ref<string | null>(null);

	function initialize() {
		const lastRead = getLastReadMessage(room.roomId);
		displayedReadMarker.value = lastRead;

		if (lastRead) {
			const stored = localStorage.getItem('lastReadMessages');
			if (stored) {
				const messages = JSON.parse(stored);
				const data = messages[room.roomId];
				if (data?.timestamp) {
					room.setLastVisibleEventId(lastRead);
					room.setLastVisibleTimeStamp(data.timestamp);
				}
			}
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
