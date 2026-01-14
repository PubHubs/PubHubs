// Packages
import { Direction } from 'matrix-js-sdk';
import { type Ref, computed, nextTick, ref } from 'vue';

// Models
import { ScrollPosition, SystemDefaults } from '@hub-client/models/constants';
import type Room from '@hub-client/models/rooms/Room';

export interface ScrollToEventFunction {
	(eventId: string, options: { position: ScrollPosition }): Promise<void>;
}

export function useTimelinePagination(container: Ref<HTMLElement | null>, room: Room, scrollToEvent: ScrollToEventFunction) {
	const isLoadingPrevious = ref(false);
	const isLoadingNext = ref(false);

	/**
	 * Check if the oldest message in the timeline is loaded
	 * Used to prevent trying to load more when we've reached the start
	 */
	const oldestEventIsLoaded = computed(() => {
		return room.isOldestMessageLoaded();
	});

	/**
	 * Check if the newest message in the timeline is loaded
	 * Used to prevent trying to load more when we've reached the end
	 */
	const newestEventIsLoaded = computed(() => {
		return room.isNewestMessageLoaded();
	});

	/**
	 * Loads previous messages when user scrolls to the top
	 */
	async function loadPrevious(): Promise<void> {
		if (isLoadingPrevious.value) {
			console.warn('[Timeline-Pagination] loadPrevious: already loading, skipping');
			return; // Prevent concurrent loads
		}

		console.warn('[Timeline-Pagination] loadPrevious: started');
		isLoadingPrevious.value = true;

		// Check if container is available
		const cont = container.value;
		if (!cont) {
			console.warn('[Timeline-Pagination] loadPrevious: no container, aborting');
			isLoadingPrevious.value = false;
			return;
		}

		// Store scroll information before loading older messages
		const prevScrollHeight = cont.scrollHeight;
		const prevScrollTop = cont.scrollTop;
		console.warn('[Timeline-Pagination] loadPrevious: before load', { prevScrollHeight, prevScrollTop });

		const prevOldestLoadedEventId = room.getTimelineOldestMessageId();
		console.warn('[Timeline-Pagination] loadPrevious: oldest event', { prevOldestLoadedEventId, oldestEventIsLoaded: oldestEventIsLoaded.value });

		if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
			// Paginate backward to load older messages
			console.warn('[Timeline-Pagination] loadPrevious: calling room.paginate');
			await room.paginate(Direction.Backward, SystemDefaults.roomTimelineLimit, prevOldestLoadedEventId);
			console.warn('[Timeline-Pagination] loadPrevious: paginate completed');

			// Wait for DOM to update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));

			// Compute the height difference caused by the newly added messages
			const newScrollHeight = cont.scrollHeight;
			const heightDiff = newScrollHeight - prevScrollHeight;
			console.warn('[Timeline-Pagination] loadPrevious: after load', { newScrollHeight, heightDiff });

			// Restore the previous scroll position + the height difference so user's viewport stays the same
			cont.scrollTop = prevScrollTop + heightDiff;
			console.warn('[Timeline-Pagination] loadPrevious: restored scroll position', { newScrollTop: cont.scrollTop });
		} else {
			console.warn('[Timeline-Pagination] loadPrevious: skipping pagination (oldest loaded or no event)');
		}

		isLoadingPrevious.value = false;
		console.warn('[Timeline-Pagination] loadPrevious: completed');
	}

	/**
	 * Loads next messages when user scrolls to the bottom
	 */
	async function loadNext(): Promise<void> {
		if (isLoadingNext.value) {
			console.warn('[Timeline-Pagination] loadNext: already loading, skipping');
			return; // Prevent concurrent loads
		}

		console.warn('[Timeline-Pagination] loadNext: started');
		isLoadingNext.value = true;

		const prevNewestLoadedEventId = room.getTimelineNewestMessageEventId();
		console.warn('[Timeline-Pagination] loadNext: newest event', { prevNewestLoadedEventId, newestEventIsLoaded: newestEventIsLoaded.value });

		if (prevNewestLoadedEventId && !newestEventIsLoaded.value) {
			// Paginate forward to load newer messages
			console.warn('[Timeline-Pagination] loadNext: calling room.paginate');
			await room.paginate(Direction.Forward, SystemDefaults.roomTimelineLimit, prevNewestLoadedEventId);
			console.warn('[Timeline-Pagination] loadNext: paginate completed');

			// Scroll to the event that was the newest before loading
			console.warn('[Timeline-Pagination] loadNext: scrolling to previous newest event');
			await scrollToEvent(prevNewestLoadedEventId, { position: ScrollPosition.End });

			// Wait for DOM to update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));
			console.warn('[Timeline-Pagination] loadNext: DOM updated');
		} else {
			console.warn('[Timeline-Pagination] loadNext: skipping pagination (newest loaded or no event)');
		}

		isLoadingNext.value = false;
		console.warn('[Timeline-Pagination] loadNext: completed');
	}

	return {
		loadPrevious,
		loadNext,
		isLoadingPrevious: computed(() => isLoadingPrevious.value),
		isLoadingNext: computed(() => isLoadingNext.value),
		oldestEventIsLoaded,
		newestEventIsLoaded,
	};
}
