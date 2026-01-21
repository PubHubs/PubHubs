/**
 * Read Marker Composable
 *
 * Manages the read marker state for a room timeline.
 *
 * KEY BEHAVIORS:
 * - displayedReadMarker is FROZEN during session (doesn't jump as user reads)
 * - Uses Room model's lastVisibleEventId for tracking (set by handlePrivateReceipt)
 * - Marker is persisted to localStorage on room exit
 * - Marker is always visible (even when caught up)
 */
import { computed, onBeforeUnmount, ref } from 'vue';

import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';

import type Room from '@hub-client/models/rooms/Room';

export function useReadMarker(room: Room) {
	const { getLastReadMessage, setLastReadMessage } = useLastReadMessages();

	// Displayed marker - frozen during session
	const displayedReadMarker = ref<string | null>(null);

	/**
	 * Initializes the read marker for a room
	 * Called when entering a room
	 */
	function initialize() {
		const lastRead = getLastReadMessage(room.roomId);
		displayedReadMarker.value = lastRead;
		console.error('[ReadMarker] Initialized', { roomId: room.roomId, lastReadEventId: lastRead });
	}

	/**
	 * Persists the current read position to localStorage
	 * Called when leaving a room
	 *
	 * Uses Room model's lastVisibleEventId which is updated by handlePrivateReceipt
	 */
	function persist() {
		const lastVisibleEventId = room.getLastVisibleEventId();
		const lastVisibleTimestamp = room.getLastVisibleTimeStamp();

		console.error('[ReadMarker] Persist', { roomId: room.roomId, lastVisibleEventId, lastVisibleTimestamp });

		if (lastVisibleEventId && lastVisibleTimestamp > 0) {
			setLastReadMessage(room.roomId, lastVisibleEventId, lastVisibleTimestamp);
		}
	}

	onBeforeUnmount(() => {
		persist();
	});

	return {
		// State
		displayedReadMarker: computed(() => displayedReadMarker.value),

		// Operations
		initialize,
		persist,
	};
}
