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
	const timelineVersion = ref(room.getTimelineVersion());

	// Pagination observer
	let paginationObserver: IntersectionObserver | null = null;
	const suppressionActive = ref(false);
	let suppressionTimeoutId: number | null = null;

	/** Sync the reactive timelineVersion ref with the room's actual timeline version */
	function refreshTimelineVersion() {
		timelineVersion.value = room.getTimelineVersion();
	}

	/**
	 * Finds a visible message to use as a scroll anchor.
	 * For backward (loading older): picks the topmost visible message (survives pruning of newest).
	 * For forward (loading newer): picks the bottommost visible message (survives pruning of oldest).
	 */
	function getScrollAnchor(cont: HTMLElement, position: 'top' | 'bottom'): { eventId: string; offset: number } | null {
		const containerRect = cont.getBoundingClientRect();
		const messages = cont.querySelectorAll<HTMLElement>('[data-event-id]');

		let best: { eventId: string; offset: number } | null = null;

		for (const msg of messages) {
			const rect = msg.getBoundingClientRect();
			if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue;

			const offset = rect.top - containerRect.top;

			if (position === 'top') {
				if (best === null || offset < best.offset) {
					best = { eventId: msg.dataset.eventId!, offset };
				}
			} else {
				if (best === null || offset > best.offset) {
					best = { eventId: msg.dataset.eventId!, offset };
				}
			}
		}

		return best;
	}

	/**
	 * Restores scroll position so the anchor element stays at the same visual offset.
	 */
	function restoreScrollAnchor(cont: HTMLElement, anchor: { eventId: string; offset: number }) {
		const el = cont.querySelector(`[data-event-id="${anchor.eventId}"]`) as HTMLElement | null;
		if (!el) return;

		const newOffset = el.getBoundingClientRect().top - cont.getBoundingClientRect().top;
		const delta = newOffset - anchor.offset;
		cont.scrollTop += delta;
	}

	// Check if the oldest message in the timeline is loaded
	const oldestEventIsLoaded = computed(() => {
		return room.isOldestMessageLoaded();
	});

	// Check if the newest message in the timeline is loaded
	const newestEventIsLoaded = computed(() => {
		return room.isNewestMessageLoaded();
	});

	// Loads older messages
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
			// Anchor on the topmost visible message (survives pruning of newest)
			const anchor = getScrollAnchor(cont, 'top');

			// Load older messages
			await room.paginate(Direction.Backward, SystemDefaults.paginationBatchSize, prevOldestEventId);
			timelineVersion.value = room.getTimelineVersion();

			// Wait for DOM update then restore scroll position
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));
			if (anchor) restoreScrollAnchor(cont, anchor);
		}

		isLoadingPrevious.value = false;
	}

	// Loads newer messages
	async function loadNext(): Promise<void> {
		if (isLoadingNext.value || newestEventIsLoaded.value) return;

		isLoadingNext.value = true;
		suppressObserverTriggers();

		const cont = container.value;
		if (!cont) {
			isLoadingPrevious.value = false;
			return;
		}

		const prevNewestEventId = room.getTimelineNewestMessageEventId();

		if (prevNewestEventId) {
			// Anchor on the bottommost visible message (survives pruning of oldest)
			const anchor = getScrollAnchor(cont, 'bottom');

			// Load newer messages
			await room.paginate(Direction.Forward, SystemDefaults.paginationBatchSize, prevNewestEventId);
			timelineVersion.value = room.getTimelineVersion();

			// Wait for DOM update then restore scroll position
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));
			if (anchor) restoreScrollAnchor(cont, anchor);
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
				rootMargin: '500px',
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

	// Suppresses observer triggers during pagination
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
		refreshTimelineVersion,
		cleanup,

		// State
		isLoadingPrevious: computed(() => isLoadingPrevious.value),
		isLoadingNext: computed(() => isLoadingNext.value),
		oldestEventIsLoaded,
		newestEventIsLoaded,
		timelineVersion: computed(() => timelineVersion.value),
	};
}
