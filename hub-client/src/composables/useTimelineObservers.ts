/**
 * Composable for managing timeline IntersectionObservers
 *
 * Centralizes the lifecycle management of all observers used in the timeline:
 * 1. Pagination observer - triggers loading previous/next messages
 * 2. Related events observer - triggers fetching reactions, edits, etc.
 * 3. Receipt observer - tracks visible events for read receipts
 * 4. Date display observer - tracks events for date popup
 */
// Packages
import { type Ref, onBeforeUnmount, ref } from 'vue';

export interface PaginationCallbacks {
	onLoadPrevious: () => void;
	onLoadNext: () => void;
}

export type RelatedEventsCallback = (eventIds: string[]) => void;

export function useTimelineObservers(container: Ref<HTMLElement | null>) {
	let paginationObserver: IntersectionObserver | null = null;
	let relatedEventsObserver: IntersectionObserver | null = null;

	// Prevents observers from triggering during pagination)
	const suppressionActive = ref(false);
	let suppressionTimeoutId: number | null = null;

	// Track visible event IDs for related events observer
	const visibleEventIds = new Set<string>();
	let relatedEventsTimeout: number | undefined;

	/**
	 * Sets up the pagination observer
	 *
	 * Observes 'sentinel' elements at the top and bottom of the timeline.
	 * When a sentinel becomes visible, triggers the corresponding callback
	 * to load more messages.
	 *
	 * @param topSentinel - Ref to the top sentinel element
	 * @param bottomSentinel - Ref to the bottom sentinel element
	 * @param callbacks - Callbacks for loading previous/next messages
	 */
	function setupPaginationObserver(topSentinel: Ref<HTMLElement | null>, bottomSentinel: Ref<HTMLElement | null>, callbacks: PaginationCallbacks) {
		console.warn('[Timeline-Observers] setupPaginationObserver: started');

		// Disconnect existing observer
		if (paginationObserver) {
			console.warn('[Timeline-Observers] setupPaginationObserver: disconnecting existing observer');
			paginationObserver.disconnect();
		}

		const options: IntersectionObserverInit = {
			root: container.value,
			threshold: 0.001, // Trigger when 0.1% of sentinel is visible
		};

		paginationObserver = new IntersectionObserver((entries) => {
			// Don't trigger during pagination
			if (suppressionActive.value) {
				console.warn('[Timeline-Observers] paginationObserver: suppression active, skipping');
				return;
			}

			entries.forEach((entry) => {
				console.warn('[Timeline-Observers] paginationObserver entry:', {
					isIntersecting: entry.isIntersecting,
					isTopSentinel: entry.target === topSentinel.value,
					isBottomSentinel: entry.target === bottomSentinel.value,
				});

				if (entry.isIntersecting) {
					if (entry.target === topSentinel.value) {
						console.warn('[Timeline-Observers] paginationObserver: top sentinel intersecting, calling onLoadPrevious');
						callbacks.onLoadPrevious();
					} else if (entry.target === bottomSentinel.value) {
						console.warn('[Timeline-Observers] paginationObserver: bottom sentinel intersecting, calling onLoadNext');
						callbacks.onLoadNext();
					}
				}
			});
		}, options);

		// Observe both sentinels
		if (topSentinel.value) {
			console.warn('[Timeline-Observers] setupPaginationObserver: observing top sentinel');
			paginationObserver.observe(topSentinel.value);
		}
		if (bottomSentinel.value) {
			console.warn('[Timeline-Observers] setupPaginationObserver: observing bottom sentinel');
			paginationObserver.observe(bottomSentinel.value);
		}

		console.warn('[Timeline-Observers] setupPaginationObserver: completed');
	}

	/**
	 * Sets up the related events observer
	 *
	 * Observes all event elements in the timeline. When events become visible,
	 * adds their IDs to a set. When scrolling stops, triggers the
	 * callback with all visible event IDs to fetch related events (reactions, edits, etc.).
	 *
	 * @param callback - Called with array of visible event IDs after scrolling stops
	 */
	function setupRelatedEventsObserver(callback: RelatedEventsCallback) {
		console.warn('[Timeline-Observers] setupRelatedEventsObserver: started');

		// Disconnect existing observer
		if (relatedEventsObserver) {
			console.warn('[Timeline-Observers] setupRelatedEventsObserver: disconnecting existing observer');
			relatedEventsObserver.disconnect();
		}

		const options: IntersectionObserverInit = {
			root: container.value,
			threshold: 0.001,
		};

		relatedEventsObserver = new IntersectionObserver((entries) => {
			// Track which events are visible
			entries.forEach((entry) => {
				const eventId = (entry.target as HTMLElement).dataset.eventId;
				if (eventId) {
					if (entry.isIntersecting) {
						visibleEventIds.add(eventId);
					} else {
						visibleEventIds.delete(eventId);
					}
				}
			});

			console.warn('[Timeline-Observers] relatedEventsObserver: visible event count:', visibleEventIds.size);

			// Wait for scrolling to stop before fetching
			if (relatedEventsTimeout) {
				clearTimeout(relatedEventsTimeout);
			}
			relatedEventsTimeout = window.setTimeout(() => {
				console.warn('[Timeline-Observers] relatedEventsObserver: debounce timeout, calling callback with', visibleEventIds.size, 'events');
				callback([...visibleEventIds]);
			}, 200);
		}, options);

		console.warn('[Timeline-Observers] setupRelatedEventsObserver: completed');
	}

	/**
	 * Observes event elements for related events
	 *
	 * This should be called after new events are added to the timeline
	 * to attach the observer to them.
	 *
	 * @param eventElements - Array of event element IDs to observe
	 */
	function observeEventElements(eventElements: string[]) {
		if (!relatedEventsObserver) return;

		eventElements.forEach((eventId) => {
			const node = document.querySelector(`[data-event-id="${eventId}"]`);
			if (node) {
				relatedEventsObserver!.observe(node);
			}
		});
	}

	/**
	 * Suppresses observer triggers for a specified duration
	 *
	 * Used during pagination to prevent the observers from triggering
	 * while the DOM is being updated. After the duration, re-enables observers.
	 *
	 * Replaces the fragile `suppressNextObservertrigger` boolean pattern
	 * with explicit timeout-based suppression.
	 *
	 * @param duration - Duration in milliseconds to suppress observers (default: 100ms)
	 */
	function suppressObserverTriggers(duration: number = 100) {
		suppressionActive.value = true;

		// Clear existing timeout if any
		if (suppressionTimeoutId !== null) {
			clearTimeout(suppressionTimeoutId);
		}

		// Set new timeout to re-enable observers
		suppressionTimeoutId = window.setTimeout(() => {
			suppressionActive.value = false;
			suppressionTimeoutId = null;
		}, duration);
	}

	/**
	 * Updates the related events observer with current timeline events
	 *
	 * Should be called when timeline changes (new messages, edits, deletions).
	 * Disconnects and reconnects the observer to all current event elements.
	 *
	 * @param eventIds - Array of event IDs currently in the timeline
	 */
	function updateRelatedEventsObserver(eventIds: string[]) {
		console.warn('[Timeline-Observers] updateRelatedEventsObserver: updating with', eventIds.length, 'events');
		relatedEventsObserver?.disconnect();
		observeEventElements(eventIds);
	}

	/**
	 * Cleanup all observers and timers
	 * Called automatically on component unmount
	 */
	function cleanupAll() {
		// Disconnect observers
		if (paginationObserver) {
			paginationObserver.disconnect();
			paginationObserver = null;
		}
		if (relatedEventsObserver) {
			relatedEventsObserver.disconnect();
			relatedEventsObserver = null;
		}

		// Clear timeouts
		if (suppressionTimeoutId !== null) {
			clearTimeout(suppressionTimeoutId);
			suppressionTimeoutId = null;
		}
		if (relatedEventsTimeout) {
			clearTimeout(relatedEventsTimeout);
			relatedEventsTimeout = undefined;
		}

		// Clear state
		visibleEventIds.clear();
	}

	// Automatic cleanup on unmount
	onBeforeUnmount(cleanupAll);

	return {
		setupPaginationObserver,
		setupRelatedEventsObserver,
		observeEventElements,
		updateRelatedEventsObserver,
		suppressObserverTriggers,
		cleanupAll,
	};
}
