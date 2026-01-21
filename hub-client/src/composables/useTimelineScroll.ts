/**
 * Timeline Scroll Composable
 *
 * Manages scroll behavior for a column-reverse timeline container.
 *
 * COORDINATE SYSTEM (column-reverse):
 * - scrollTop = 0 → visual bottom (newest messages)
 * - scrollTop = max → visual top (oldest messages)
 *
 * TERMINOLOGY:
 * - "newest" = visual bottom, most recent messages
 * - "oldest" = visual top, historical messages
 * - "isAtNewest" = user can see the latest messages
 */
import { type Ref, computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

import { ScrollBehavior, ScrollPosition, TimelineScrollConstants } from '@hub-client/models/constants';
import type { TCurrentEvent } from '@hub-client/models/events/types';
import type Room from '@hub-client/models/rooms/Room';

export interface ScrollOptions {
	position: ScrollPosition.Start | ScrollPosition.Center | ScrollPosition.End | ScrollPosition.TopWithPadding;
	behavior?: ScrollBehavior.Smooth | ScrollBehavior.Auto;
	highlight?: boolean;
}

export interface InitialScrollParams {
	explicitEventId?: string;
	lastReadEventId?: string;
}

const { SCROLL_THRESHOLD, SCROLL_DEBOUNCE } = TimelineScrollConstants;

export function useTimelineScroll(container: Ref<HTMLElement | null>, room: Room, currentUserId: string) {
	// Core state
	const isAtNewest = ref(true);
	const newMessageCount = ref(0);
	const isInitialScrollComplete = ref(false);

	// Scroll tracking
	let scrollTimeoutId: number | null = null;

	/**
	 * Checks if user is at newest messages (visual bottom)
	 */
	function checkIsAtNewest(): boolean {
		if (!container.value) return true;
		return container.value.scrollTop >= -SCROLL_THRESHOLD; // Because of column-reversed, scrollTop values are negative
	}

	/**
	 * Handles scroll events (debounced)
	 */
	function handleScroll() {
		if (!container.value) return;

		// Clear existing timeout
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
		}

		// Debounce the state update
		scrollTimeoutId = window.setTimeout(() => {
			const wasAtNewest = isAtNewest.value;
			isAtNewest.value = checkIsAtNewest();

			// User scrolled to newest - reset count
			if (!wasAtNewest && isAtNewest.value) {
				newMessageCount.value = 0;
			}

			scrollTimeoutId = null;
		}, SCROLL_DEBOUNCE);
	}

	/**
	 * Scrolls to newest messages (visual bottom)
	 * Uses smooth scrolling per user preference
	 */
	function scrollToNewest() {
		if (!container.value) return;
		// In column-reverse, newest is scrollTop = 0
		container.value.scrollTo({ top: 0, behavior: 'smooth' });
		isAtNewest.value = true;
		newMessageCount.value = 0;
	}

	/**
	 * Applies highlight animation to an element
	 */
	function applyHighlight(element: HTMLElement) {
		element.classList.add('highlighted');
		window.setTimeout(() => {
			element.classList.add('unhighlighted');
			window.setTimeout(() => {
				element.classList.remove('highlighted', 'unhighlighted');
			}, 500);
		}, 2000);
	}

	/**
	 * Scrolls to a specific event
	 */
	async function scrollToEvent(eventId: string, options: ScrollOptions = { position: ScrollPosition.Center }): Promise<void> {
		console.error('[scrollToEvent] Called', { eventId, options });

		if (!container.value) {
			console.error('[scrollToEvent] Container not mounted');
			throw new Error('Container not mounted');
		}

		// Try to find element in current timeline
		let element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
		console.error('[scrollToEvent] Initial element search', { found: !!element });

		// If not found, try to load it
		if (!element) {
			console.error('[scrollToEvent] Element not found, loading event from server');
			try {
				const currentEvent: TCurrentEvent = { eventId };
				await room.loadToEvent(currentEvent);
				console.error('[scrollToEvent] loadToEvent completed');

				// Wait for Vue to render the DOM after loading
				await nextTick();
				await new Promise((resolve) => requestAnimationFrame(resolve));

				// Retry finding the element a few times
				for (let i = 0; i < 5 && !element; i++) {
					element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
					console.error('[scrollToEvent] Retry attempt', { attempt: i + 1, found: !!element });
					if (!element) {
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
				}
			} catch (error) {
				console.error('[scrollToEvent] loadToEvent failed', error);
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`, { error });
				throw error;
			}
		}

		if (!element) {
			console.error('[scrollToEvent] Element not found after all attempts');
			LOGGER.warn(SMI.ROOM_TIMELINE, `Event ${eventId} not found after loading`);
			throw new Error(`Event ${eventId} not found`);
		}

		console.error('[scrollToEvent] Element found, proceeding with scroll');

		const behavior = options.behavior ?? ScrollBehavior.Smooth;

		if (options.position === ScrollPosition.End) {
			// Scroll to newest - in column-reverse, this is scrollTop = 0
			container.value.scrollTo({ top: 0, behavior });
			isAtNewest.value = true;
		} else if (options.position === ScrollPosition.Start) {
			// Scroll to oldest - in column-reverse, this is scrollTop = max
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			container.value.scrollTo({ top: maxScroll, behavior });
			isAtNewest.value = false;
		} else if (options.position === ScrollPosition.TopWithPadding) {
			// Position element near visual top with padding (for last read marker)
			// scrollIntoView block:'start' puts element at top of viewport in column-reverse

			element.scrollIntoView({ block: 'start', behavior });

			// Wait for scroll to complete
			await new Promise((resolve) => setTimeout(resolve, behavior === 'smooth' ? 300 : 50));

			// Adjust if element is slightly above the visible container
			// We want element at containerTop + small padding (e.g., 10px)
			const elementTop = element.getBoundingClientRect().top;
			const containerTop = container.value.getBoundingClientRect().top;
			const targetTop = containerTop + 10; // Small padding from top edge

			if (elementTop < targetTop) {
				// Element is above where we want it - need to scroll less (toward newest)
				// In column-reverse with negative scrollTop, making it less negative scrolls toward newest
				const adjustment = targetTop - elementTop;
				container.value.scrollTop += adjustment;
			}

			isAtNewest.value = checkIsAtNewest();
		} else {
			// ScrollPosition.Center - center the element in viewport
			// In column-reverse: SUBTRACT offset to move element to center
			const containerRect = container.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const currentScrollTop = container.value.scrollTop;

			const elementCenter = elementRect.top + elementRect.height / 2;
			const containerCenter = containerRect.top + containerRect.height / 2;
			const offset = elementCenter - containerCenter;
			let scrollTarget = currentScrollTop - offset;

			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

			container.value.scrollTo({ top: scrollTarget, behavior });
			isAtNewest.value = checkIsAtNewest();
		}

		// Wait for scroll to complete
		const waitTime = behavior === ScrollBehavior.Smooth ? 300 : 50;
		await new Promise((resolve) => setTimeout(resolve, waitTime));

		// Apply highlight if requested
		if (options.highlight && element) {
			applyHighlight(element);
		}
	}

	/**
	 * Handles new messages arriving in the timeline
	 */
	function handleNewMessage(_eventId: string, senderId: string) {
		console.error('[handleNewMessage]', {
			senderId,
			currentUserId,
			isOwnMessage: senderId === currentUserId,
			isAtNewest: isAtNewest.value,
			currentCount: newMessageCount.value,
		});

		// Own messages always scroll to newest
		if (senderId === currentUserId) {
			scrollToNewest();
			return;
		}

		// If at newest, auto-scroll will happen naturally
		if (isAtNewest.value) {
			return;
		}

		// Not at newest - increment counter for "new messages" button
		newMessageCount.value++;
		console.error('[handleNewMessage] Incremented count to', newMessageCount.value);
	}

	/**
	 * Performs initial scroll based on priority system
	 *
	 * Priority 1: Explicit eventId (from search, navigation)
	 * Priority 2: Last read message (returning to room)
	 * Priority 3: Default to newest (first visit)
	 */
	async function performInitialScroll(params: InitialScrollParams = {}): Promise<void> {
		console.error('[InitialScroll] Starting', {
			explicitEventId: params.explicitEventId,
			lastReadEventId: params.lastReadEventId,
		});

		try {
			// Priority 1: Explicit eventId (from search, navigation)
			if (params.explicitEventId) {
				console.error('[InitialScroll] Priority 1: Explicit eventId', params.explicitEventId);
				try {
					await scrollToEvent(params.explicitEventId, {
						position: ScrollPosition.Center,
						behavior: ScrollBehavior.Smooth,
						highlight: true,
					});
					console.error('[InitialScroll] Scrolled to explicit event');
				} catch (error) {
					console.error('[InitialScroll] Failed to scroll to explicit event, falling back to newest', error);
					// Event not found - fall back to newest
					const newestEventId = room.getTimelineNewestMessageEventId();
					if (newestEventId) {
						await scrollToEvent(newestEventId, {
							position: ScrollPosition.End,
							behavior: ScrollBehavior.Auto,
						});
					}
				}
				isInitialScrollComplete.value = true;
				return;
			}

			// Priority 2: Last read message (returning to room)
			if (params.lastReadEventId) {
				console.error('[InitialScroll] Priority 2: Last read', { lastReadEventId: params.lastReadEventId });

				// Calculate unread count (messages between last read and newest)
				const timeline = room.getTimeline();
				const lastReadIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === params.lastReadEventId);
				const newestIndex = timeline.length - 1;

				if (lastReadIndex !== -1 && newestIndex > lastReadIndex) {
					const unreadCount = newestIndex - lastReadIndex;
					newMessageCount.value = unreadCount;
					console.error('[InitialScroll] Set initial unread count', { unreadCount, lastReadIndex, newestIndex });
				}

				try {
					// Always scroll to last read at top - scroll bounds naturally handle "not enough messages" case
					await scrollToEvent(params.lastReadEventId, {
						position: ScrollPosition.TopWithPadding,
						behavior: ScrollBehavior.Auto,
					});
					console.error('[InitialScroll] Scrolled to last read event');
				} catch (error) {
					console.error('[InitialScroll] Failed to scroll to last read, falling back to newest', error);
					// Last read event not found - fall back to newest
					newMessageCount.value = 0; // Reset count if we couldn't scroll to last read
					const newestEventId = room.getTimelineNewestMessageEventId();
					if (newestEventId) {
						await scrollToEvent(newestEventId, {
							position: ScrollPosition.End,
							behavior: ScrollBehavior.Auto,
						});
					}
				}
				isInitialScrollComplete.value = true;
				return;
			}

			// Priority 3: Default to newest (first visit)
			console.error('[InitialScroll] Priority 3: No last read, scrolling to newest');
			const newestEventId = room.getTimelineNewestMessageEventId();
			if (newestEventId) {
				await scrollToEvent(newestEventId, {
					position: ScrollPosition.End,
					behavior: ScrollBehavior.Auto,
				});
			}
			isInitialScrollComplete.value = true;
		} catch (error) {
			console.error('[InitialScroll] Unexpected error', error);
			isInitialScrollComplete.value = true;
		}
	}

	/**
	 * Resets initial scroll state (for room changes)
	 */
	function resetInitialScroll() {
		isInitialScrollComplete.value = false;
	}

	/**
	 * Set up scroll listener on mount
	 */
	onMounted(() => {
		if (container.value) {
			container.value.addEventListener('scroll', handleScroll, { passive: true });
			isAtNewest.value = checkIsAtNewest();
		}
	});

	/**
	 * Cleanup on unmount
	 */
	function cleanup() {
		container.value?.removeEventListener('scroll', handleScroll);
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
			scrollTimeoutId = null;
		}
	}

	onBeforeUnmount(cleanup);

	/**
	 * Computed: Show new messages button
	 * Shows when not at newest AND has new messages
	 */
	const showNewMessagesButton = computed(() => {
		return !isAtNewest.value && newMessageCount.value > 0;
	});

	/**
	 * Computed: Show jump to bottom button
	 * Shows when not at newest AND no new messages (mutually exclusive with new messages button)
	 */
	const showJumpToBottomButton = computed(() => {
		return !isAtNewest.value;
	});

	return {
		// Scroll operations
		scrollToEvent,
		scrollToNewest,
		performInitialScroll,
		resetInitialScroll,
		handleNewMessage,

		// State
		isAtNewest: computed(() => isAtNewest.value),
		newMessageCount: computed(() => newMessageCount.value),
		isInitialScrollComplete: computed(() => isInitialScrollComplete.value),

		// Button visibility (mutually exclusive)
		showNewMessagesButton,
		showJumpToBottomButton,

		// Lifecycle
		cleanup,
	};
}
