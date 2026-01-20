// Packages
import { computed, ref } from 'vue';

// Composables
import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { ScrollBehavior, ScrollPosition } from '@hub-client/models/constants';
import type Room from '@hub-client/models/rooms/Room';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

export interface InitialScrollParams {
	explicitEventId?: string; // Priority 1: from search, navigation, etc.
	lastReadEventId?: string; // Priority 2: where user left off
	defaultToNewest?: boolean; // Priority 3: scroll to newest
}

export interface ScrollToEventFunction {
	(eventId: string, options: any): Promise<void>;
}

export interface IsEventVisibleFunction {
	(eventId: string): boolean;
}

const NEAR_END_THRESHOLD = 3; // Messages within this count are considered "near end"

export function useInitialScroll(roomId: string, room: Room, scrollToEvent: ScrollToEventFunction) {
	const isInitialScrollComplete = ref(false);
	const rooms = useRooms();
	const { getLastReadMessage, setLastReadMessage } = useLastReadMessages();

	/**
	 * Gets the initial scroll target based on three-tier priority
	 */
	function getInitialScrollTarget(): InitialScrollParams {
		console.warn('[Timeline-InitialScroll] getInitialScrollTarget: starting', { roomId });

		// Priority 1: Explicit navigation
		const explicitEventId = rooms.scrollPositions[roomId];
		console.warn('[Timeline-InitialScroll] Priority 1 check - explicit eventId:', explicitEventId);
		if (explicitEventId) {
			// Clear it after reading
			delete rooms.scrollPositions[roomId];
			console.warn('[Timeline-InitialScroll] Using Priority 1 (explicit)');
			return { explicitEventId };
		}

		// Priority 2: Last read message
		const lastReadEventId = getLastReadMessage(roomId);
		console.warn('[Timeline-InitialScroll] Priority 2 check - last read eventId:', lastReadEventId);
		if (lastReadEventId) {
			console.warn('[Timeline-InitialScroll] Using Priority 2 (last read)');
			return { lastReadEventId };
		}

		// Priority 3: Default to newest
		console.warn('[Timeline-InitialScroll] Using Priority 3 (default to newest)');
		return { defaultToNewest: true };
	}

	/**
	 * Saves the current scroll position as the last read message
	 *
	 * Called when the user leaves a room (route change).
	 */
	function saveScrollPosition(eventId: string, timestamp: number) {
		setLastReadMessage(roomId, eventId, timestamp);
	}

	/**
	 * Performs initial scroll based on priority system
	 *
	 * This function decides where to scroll and then performs
	 * a single scroll operation with 'instant' behavior.
	 */
	async function performInitialScroll(overrides?: Partial<InitialScrollParams>): Promise<void> {
		console.warn('[Timeline-InitialScroll] performInitialScroll: started');

		// Get scroll target from priority system
		const target = getInitialScrollTarget();
		console.warn('[Timeline-InitialScroll] getInitialScrollTarget returned:', target);

		// Allow overrides from props
		const params: InitialScrollParams = {
			...target,
			...overrides,
		};

		console.warn('[Timeline-InitialScroll] Final params after overrides:', params);
		LOGGER.log(SMI.ROOM_TIMELINE, 'Performing initial scroll', params);

		try {
			// Priority 1: Explicit eventId (highest priority)
			// Used for search results, thread navigation, URL parameters
			if (params.explicitEventId) {
				console.warn('[Timeline-InitialScroll] Using Priority 1: explicit eventId', params.explicitEventId);
				await scrollToExplicitEvent(params.explicitEventId);
				isInitialScrollComplete.value = true;
				console.warn('[Timeline-InitialScroll] Priority 1 completed');
				return;
			}

			// Priority 2: Last read message
			// Used for returning to a room where user previously read messages
			if (params.lastReadEventId) {
				console.warn('[Timeline-InitialScroll] Using Priority 2: last read', params.lastReadEventId);
				await scrollToLastRead(params.lastReadEventId);
				isInitialScrollComplete.value = true;
				console.warn('[Timeline-InitialScroll] Priority 2 completed');
				return;
			}

			// Priority 3: Default to newest (lowest priority)
			// Used for first-time room visits
			if (params.defaultToNewest) {
				console.warn('[Timeline-InitialScroll] Using Priority 3: default to newest');
				await scrollToNewest();
				isInitialScrollComplete.value = true;
				console.warn('[Timeline-InitialScroll] Priority 3 completed');
				return;
			}

			// No scroll needed
			console.warn('[Timeline-InitialScroll] No scroll needed');
			isInitialScrollComplete.value = true;
		} catch (error) {
			console.error('[Timeline-InitialScroll] Initial scroll failed:', error);
			LOGGER.error(SMI.ROOM_TIMELINE, 'Initial scroll failed', { error, params });
			isInitialScrollComplete.value = true; // Mark complete even on error
		}
	}

	/**
	 * Priority 1: Scroll to explicit event (from search, thread, etc.)
	 *
	 * Uses smooth scrolling and centers the event.
	 * Highlights the event to draw user's attention.
	 *
	 * @param eventId - The explicit event to scroll to
	 */
	async function scrollToExplicitEvent(eventId: string): Promise<void> {
		LOGGER.log(SMI.ROOM_TIMELINE, 'Scrolling to explicit event', { eventId });

		await scrollToEvent(eventId, {
			position: ScrollPosition.Center,
			behavior: ScrollBehavior.Smooth,
			highlight: true,
		});
	}

	/**
	 * Priority 2: Scroll to last read message
	 *
	 * 1. Check if last read is "near" the newest message (within 3 messages)
	 * 2. If near: Scroll to newest (last read will (probablt) be visible)
	 * 3. If not near: Scroll directly to last read
	 *
	 * @param lastReadEventId - The last read event ID
	 */
	async function scrollToLastRead(lastReadEventId: string): Promise<void> {
		console.warn('[Timeline-InitialScroll] scrollToLastRead:', { lastReadEventId });
		LOGGER.log(SMI.ROOM_TIMELINE, 'Scrolling to last read', { lastReadEventId });

		const newestEventId = room.getTimelineNewestMessageEventId();
		console.warn('[Timeline-InitialScroll] scrollToLastRead: newestEventId:', newestEventId);

		// Timeline empty or not loaded yet
		if (!newestEventId) {
			console.warn('[Timeline-InitialScroll] scrollToLastRead: no newest event, aborting');
			LOGGER.warn(SMI.ROOM_TIMELINE, 'Cannot scroll to last read: no newest event');
			return;
		}

		// Check if lastRead is near the end
		const nearEnd = isEventNearEnd(lastReadEventId, newestEventId);
		console.warn('[Timeline-InitialScroll] scrollToLastRead: isEventNearEnd:', nearEnd);

		if (nearEnd) {
			// User only has a few unread messages
			console.warn('[Timeline-InitialScroll] scrollToLastRead: near end, scrolling to newest');
			LOGGER.log(SMI.ROOM_TIMELINE, 'Last read near end, scrolling to newest');
			await scrollToEvent(newestEventId, {
				position: ScrollPosition.End,
				behavior: ScrollBehavior.Auto,
			});
		} else {
			// User has many unread messages
			console.warn('[Timeline-InitialScroll] scrollToLastRead: far from end, scrolling to last read at top');
			LOGGER.log(SMI.ROOM_TIMELINE, 'Last read far from end, scrolling to last read at top');
			await scrollToEvent(lastReadEventId, {
				position: ScrollPosition.TopWithPadding,
				behavior: ScrollBehavior.Auto,
			});
		}
	}

	/**
	 * Priority 3: Scroll to newest message
	 *
	 * Used when no last read marker exists (first visit to room).
	 *
	 * @param options - Optional scroll options
	 */
	async function scrollToNewest(): Promise<void> {
		const newestEventId = room.getTimelineNewestMessageEventId();

		if (!newestEventId) {
			LOGGER.warn(SMI.ROOM_TIMELINE, 'Cannot scroll to newest: no events');
			return;
		}

		LOGGER.log(SMI.ROOM_TIMELINE, 'Scrolling to newest', { newestEventId });

		await scrollToEvent(newestEventId, {
			position: ScrollPosition.End,
			behavior: ScrollBehavior.Auto,
		});
	}

	// TODO: Actually try to detect if the last read message is in the vierport instead of guessing
	/**
	 * Determines if two events are near each other
	 *
	 * Used to decide if last read marker warrants scrolling away from newest.
	 * If last read is within NEAR_END_THRESHOLD messages of newest, we consider
	 * them 'near' and just scroll to newest (both will be visible).
	 *
	 * This prevents unnecessary scrolling when user only has a few unread messages.
	 *
	 * @param eventId - The event to check (typically last read)
	 * @param newestEventId - The newest event in timeline
	 * @returns true if events are near each other (within threshold)
	 */
	function isEventNearEnd(eventId: string, newestEventId: string): boolean {
		const timeline = room.getTimeline();

		const eventIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === eventId);
		const newestIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === newestEventId);

		console.warn('[Timeline-InitialScroll] isEventNearEnd:', {
			eventId,
			newestEventId,
			eventIndex,
			newestIndex,
			timelineLength: timeline.length,
		});

		if (eventIndex === -1 || newestIndex === -1) {
			// Can't determine, assume not near
			console.warn('[Timeline-InitialScroll] isEventNearEnd: event not found in timeline, returning false');
			return false;
		}

		const messagesBetween = newestIndex - eventIndex;
		const result = messagesBetween <= NEAR_END_THRESHOLD;
		console.warn('[Timeline-InitialScroll] isEventNearEnd:', { messagesBetween, NEAR_END_THRESHOLD, result });
		return result;
	}

	/**
	 * Resets initial scroll state
	 *
	 * Useful for room changes or when re-entering a room.
	 */
	function reset() {
		isInitialScrollComplete.value = false;
	}

	return {
		performInitialScroll,
		saveScrollPosition,
		isInitialScrollComplete: computed(() => isInitialScrollComplete.value),
		reset,
	};
}
