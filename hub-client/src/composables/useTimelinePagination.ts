/**
 * Timeline Pagination Composable
 *
 * Handles loading older/newer messages with scroll position preservation.
 */
// Packages
import { Direction } from 'matrix-js-sdk';
import { type Ref, computed, nextTick, onBeforeUnmount, ref } from 'vue';

// Models
import { SystemDefaults, TimelineScrollConstants } from '@hub-client/models/constants';
import type Room from '@hub-client/models/rooms/Room';

const { PAGINATION_COOLDOWN } = TimelineScrollConstants;

export function useTimelinePagination(container: Ref<HTMLElement | null>, room: Room) {
	const isLoadingPrevious = ref(false);
	const isLoadingNext = ref(false);

	// Pagination observer
	let paginationObserver: IntersectionObserver | null = null;
	const suppressionActive = ref(false);
	let suppressionTimeoutId: number | null = null;

	// Check if the oldest message in the timeline is loaded
	const oldestEventIsLoaded = computed(() => {
		return room.isOldestMessageLoaded();
	});

	// Check if the newest message in the timeline is loaded
	const newestEventIsLoaded = computed(() => {
		return room.isNewestMessageLoaded();
	});

	// Loads older messages (backward pagination)
	async function loadPrevious(): Promise<void> {
		if (isLoadingPrevious.value || oldestEventIsLoaded.value) return;

		isLoadingPrevious.value = true;
		suppressObserverTriggers();

		const cont = container.value;
		if (!cont) {
			isLoadingPrevious.value = false;
			return;
		}

		const prevOldestEventId = room.getTimelineOldestMessageId();

		if (prevOldestEventId) {
			// Store scroll position before loading
			const prevScrollHeight = cont.scrollHeight;
			const prevScrollTop = cont.scrollTop;

			// Load older messages
			await room.paginate(Direction.Backward, SystemDefaults.roomTimelineLimit, prevOldestEventId);

			// Wait for DOM update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));

			// Restore scroll position
			const heightDiff = cont.scrollHeight - prevScrollHeight;
			cont.scrollTop = prevScrollTop + heightDiff;
		}

		isLoadingPrevious.value = false;
	}

	// Loads newer messages (forward pagination)
	async function loadNext(): Promise<void> {
		if (isLoadingNext.value || newestEventIsLoaded.value) return;

		isLoadingNext.value = true;
		suppressObserverTriggers();

		const prevNewestEventId = room.getTimelineNewestMessageEventId();

		if (prevNewestEventId) {
			// Load newer messages
			await room.paginate(Direction.Forward, SystemDefaults.roomTimelineLimit, prevNewestEventId);

			// Wait for DOM update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}

		isLoadingNext.value = false;
	}

	// Sets up the pagination observer
	function setupPaginationObserver(topSentinel: Ref<HTMLElement | null>, bottomSentinel: Ref<HTMLElement | null>) {
		if (!container.value) return;

		// Disconnect existing observer
		if (paginationObserver) {
			paginationObserver.disconnect();
		}

		paginationObserver = new IntersectionObserver(
			(entries) => {
				// Don't trigger during pagination
				if (suppressionActive.value) return;

				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;

					if (entry.target === topSentinel.value) {
						loadPrevious();
					} else if (entry.target === bottomSentinel.value) {
						loadNext();
					}
				});
			},
			{
				root: container.value,
				threshold: 0.001,
			},
		);

		// Observe sentinels
		if (topSentinel.value) {
			paginationObserver.observe(topSentinel.value);
		}
		if (bottomSentinel.value) {
			paginationObserver.observe(bottomSentinel.value);
		}
	}

	/**
	 * Suppresses observer triggers during pagination
	 */
	function suppressObserverTriggers() {
		suppressionActive.value = true;

		if (suppressionTimeoutId !== null) {
			clearTimeout(suppressionTimeoutId);
		}

		suppressionTimeoutId = window.setTimeout(() => {
			suppressionActive.value = false;
			suppressionTimeoutId = null;
		}, PAGINATION_COOLDOWN);
	}

	// Cleanup observers and timers
	function cleanup() {
		if (paginationObserver) {
			paginationObserver.disconnect();
			paginationObserver = null;
		}
		if (suppressionTimeoutId !== null) {
			clearTimeout(suppressionTimeoutId);
			suppressionTimeoutId = null;
		}
	}

	onBeforeUnmount(cleanup);

	return {
		// Operations
		loadPrevious,
		loadNext,
		setupPaginationObserver,
		cleanup,

		// State
		isLoadingPrevious: computed(() => isLoadingPrevious.value),
		isLoadingNext: computed(() => isLoadingNext.value),
		oldestEventIsLoaded,
		newestEventIsLoaded,
	};
}
