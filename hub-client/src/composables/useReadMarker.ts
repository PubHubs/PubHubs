// Packages
import { computed, ref } from 'vue';

// Models
import type Room from '@hub-client/models/rooms/Room';

function useReadMarker(room: Room, userId: string, threadRootId: string | undefined) {
	const displayedReadMarker = ref<string | null>(null);

	function initialize() {
		// In-session cache (survives navigation within same session)
		const inSessionEventId = room.getLastVisibleEventId(threadRootId);
		if (inSessionEventId) {
			displayedReadMarker.value = inSessionEventId;
			return;
		}

		// Server-synced read receipt
		const serverEventId = room.getEventReadUpTo(userId);
		if (serverEventId) {
			displayedReadMarker.value = serverEventId;
			const event = room.findEventById(serverEventId);
			if (event) {
				room.setLastVisibleEventId(serverEventId, threadRootId);
				room.setLastVisibleTimeStamp(event.localTimestamp || event.getTs(), threadRootId);
			}
		}
	}

	function update(eventId: string, timestamp: number) {
		if (timestamp <= room.getLastVisibleTimeStamp(threadRootId)) {
			return;
		}

		room.setLastVisibleEventId(eventId, threadRootId);
		room.setLastVisibleTimeStamp(timestamp, threadRootId);
	}

	return {
		displayedReadMarker: computed(() => displayedReadMarker.value),
		initialize,
		update,
	};
}

export default useReadMarker;
