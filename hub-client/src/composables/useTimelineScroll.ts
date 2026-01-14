// Packages
import { type Ref, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { ScrollBehavior, ScrollPosition } from '@hub-client/models/constants';
import type { TCurrentEvent } from '@hub-client/models/events/types';
import type Room from '@hub-client/models/rooms/Room';

export interface ScrollOptions {
	position: ScrollPosition.Start | ScrollPosition.Center | ScrollPosition.End;
	behavior?: ScrollBehavior.Smooth | ScrollBehavior.Auto;
	highlight?: boolean;
}

// Responsive threshold
const BOTTOM_THRESHOLD = 0;
const SCROLL_TIMEOUT = 200;

export function useTimelineScroll(container: Ref<HTMLElement | null>, room: Room, currentUserId: string) {
	// Scroll state
	const isScrolling = ref(false);
	const scrollDirection = ref<'up' | 'down' | null>(null);

	// New messages indicator state
	const isAtBottom = ref(true);
	const newMessageCount = ref(0);
	const lastSeenEventId = ref<string | null>(null);

	let scrollTimeoutId: number | null = null;
	let lastScrollTop = 0;

	/**
	 * Checks if user is scrolled near the bottom
	 */
	function checkIfAtBottom(): boolean {
		if (!container.value) return true;
		const { scrollTop, scrollHeight, clientHeight } = container.value;
		const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
		const result = distanceFromBottom <= BOTTOM_THRESHOLD;
		console.warn('[Timeline-Scroll] checkIfAtBottom:', { distanceFromBottom, BOTTOM_THRESHOLD, isAtBottom: result, scrollTop, scrollHeight, clientHeight });
		return result;
	}

	/**
	 * Resets the new message count
	 */
	function resetCount() {
		newMessageCount.value = 0;
		const newestEventId = room.getTimelineNewestMessageEventId();
		if (newestEventId) {
			lastSeenEventId.value = newestEventId;
		}
	}

	/**
	 * Handles scroll events
	 *
	 * TODO: wait for initial scroll
	 */
	const handleScroll = () => {
		if (!container.value) return;

		// Detect scroll direction
		const currentScrollTop = container.value.scrollTop;
		scrollDirection.value = currentScrollTop > lastScrollTop ? 'down' : 'up';
		lastScrollTop = currentScrollTop;

		isScrolling.value = true;

		// Check if at bottom
		const wasAtBottom = isAtBottom.value;
		isAtBottom.value = checkIfAtBottom();

		console.warn('[Timeline-Scroll] handleScroll:', {
			direction: scrollDirection.value,
			scrollTop: currentScrollTop,
			wasAtBottom,
			isAtBottom: isAtBottom.value,
			newMessageCount: newMessageCount.value,
		});

		// If user just scrolled to bottom, reset count
		if (!wasAtBottom && isAtBottom.value) {
			console.warn('[Timeline-Scroll] User scrolled to bottom, resetting count');
			resetCount();
		}

		// Update last seen event when at bottom
		if (isAtBottom.value) {
			const newestEventId = room.getTimelineNewestMessageEventId();
			if (newestEventId) {
				lastSeenEventId.value = newestEventId;
				console.warn('[Timeline-Scroll] At bottom, updated lastSeenEventId:', newestEventId);
			}
		}

		// Clear existing timeout
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
		}

		// Set new timeout to detect when scrolling stops
		scrollTimeoutId = window.setTimeout(() => {
			console.warn('[Timeline-Scroll] Scrolling stopped');
			isScrolling.value = false;
			scrollDirection.value = null;
			scrollTimeoutId = null;
		}, SCROLL_TIMEOUT);
	};

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
		console.warn('[Timeline-Scroll] scrollToEvent called:', { eventId, options });
		LOGGER.log(SMI.ROOM_TIMELINE, `Scrolling to event: ${eventId}`, { eventId, position: options.position });

		if (!container.value) {
			console.error('[Timeline-Scroll] Container not mounted');
			throw new Error('Container not mounted');
		}

		// Try to find element in current timeline
		let element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
		console.warn('[Timeline-Scroll] Element found in DOM:', !!element);

		// If not found, try to load it
		if (!element) {
			console.warn('[Timeline-Scroll] Element not found, attempting to load event');
			try {
				const currentEvent: TCurrentEvent = { eventId };
				await room.loadToEvent(currentEvent);
				element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
				console.warn('[Timeline-Scroll] After loadToEvent, element found:', !!element);
			} catch (error) {
				console.error('[Timeline-Scroll] Failed to load event:', error);
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`, { error });
				throw error;
			}
		}

		if (!element) {
			console.warn('[Timeline-Scroll] Event not found after loading');
			LOGGER.warn(SMI.ROOM_TIMELINE, `Event ${eventId} not found after loading`);
			return;
		}

		const behavior = options.behavior ?? ScrollBehavior.Smooth;
		console.warn('[Timeline-Scroll] Initiating scroll with behavior:', behavior);

		// Scroll, then wait a bit for it to complete
		if (options.position === ScrollPosition.End) {
			// For 'end' position, scroll to absolute bottom of container
			const scrollTarget = container.value.scrollHeight;
			console.warn('[Timeline-Scroll] Scrolling to absolute bottom:', scrollTarget);
			container.value.scrollTo({
				top: scrollTarget,
				behavior: behavior,
			});
		} else {
			// For other positions, use scrollIntoView
			console.warn('[Timeline-Scroll] Scrolling element into view, position:', options.position);
			element.scrollIntoView({
				block: options.position,
				behavior: behavior,
			});
		}

		// Wait for scroll to complete
		const waitTime = behavior === ScrollBehavior.Smooth ? 300 : 0;
		console.warn('[Timeline-Scroll] Waiting for scroll to complete:', waitTime, 'ms');
		await new Promise((resolve) => setTimeout(resolve, waitTime));

		console.warn('[Timeline-Scroll] Scroll completed, final position:', container.value.scrollTop);

		// Apply highlight if requested
		if (options.highlight && element) {
			console.warn('[Timeline-Scroll] Applying highlight to element');
			applyHighlight(element);
		}
	}

	/**
	 * Scrolls to a position without targeting a specific event
	 */
	function scrollToPosition(position: ScrollPosition) {
		if (!container.value) return;

		const scrollOptions: ScrollToOptions = {
			behavior: 'smooth',
		};

		switch (position) {
			case ScrollPosition.Start:
				scrollOptions.top = 0;
				break;
			case ScrollPosition.End:
				scrollOptions.top = container.value.scrollHeight;
				break;
			case ScrollPosition.Center:
				scrollOptions.top = container.value.scrollHeight / 2;
				break;
		}

		container.value.scrollTo(scrollOptions);
	}

	/**
	 * Checks if an event is currently visible in the viewport
	 */
	function isEventVisible(eventId: string): boolean {
		if (!container.value) return false;

		const containerRect = container.value.getBoundingClientRect();
		const element = container.value.querySelector(`[id="${eventId}"]`);

		if (!element) return false;

		const elementRect = element.getBoundingClientRect();
		return elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.top;
	}

	/**
	 * Handles new messages arriving in the timeline
	 */
	function handleNewMessage(eventId: string, senderId: string) {
		console.log('[Timeline-Scroll] handleNewMessage:', { eventId, senderId, isAtBottom: isAtBottom.value, currentUserId });

		// Don't count if user is at bottom
		if (isAtBottom.value) {
			lastSeenEventId.value = eventId;
			console.log('[Timeline-Scroll] User at bottom, not counting new message');
			return;
		}

		// Don't count user's own messages
		if (senderId === currentUserId) {
			console.log('[Timeline-Scroll] Own message, not counting');
			return;
		}

		// Increment count
		newMessageCount.value++;
		console.log('[Timeline-Scroll] New message count incremented to:', newMessageCount.value);
	}

	/**
	 * Watch for timeline changes (new messages)
	 */
	const timelineLength = computed(() => room.getTimeline().length);

	watch(timelineLength, (newLength, oldLength) => {
		console.log('[Timeline-Scroll] Timeline length changed:', { newLength, oldLength });
		if (newLength > oldLength && oldLength > 0) {
			// New message(s) arrived
			const timeline = room.getTimeline();
			const newMessages = timeline.slice(oldLength);
			console.log('[Timeline-Scroll] New messages detected:', newMessages.length);

			// Process each new message
			newMessages.forEach((item) => {
				const eventId = item.matrixEvent.event.event_id;
				const senderId = item.matrixEvent.event.sender;

				if (eventId && senderId) {
					handleNewMessage(eventId, senderId);
				}
			});
		}
	});

	/**
	 * Set up scroll listener on mount
	 */
	onMounted(() => {
		if (container.value) {
			container.value.addEventListener('scroll', handleScroll, { passive: true });
			lastScrollTop = container.value.scrollTop;
			handleScroll();
		}
	});

	/**
	 * Cleanup on unmount
	 */
	const cleanup = () => {
		container.value?.removeEventListener('scroll', handleScroll);
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
			scrollTimeoutId = null;
		}
	};

	onBeforeUnmount(cleanup);

	/**
	 * Whether to show the new messages indicator
	 */
	const showIndicator = computed(() => {
		return !isAtBottom.value && newMessageCount.value > 0;
	});

	return {
		// Operations
		scrollToEvent,
		scrollToPosition,
		isEventVisible,
		resetCount,

		// State
		isScrolling: computed(() => isScrolling.value),
		scrollDirection: computed(() => scrollDirection.value),

		// New messages indicator
		showIndicator,
		newMessageCount: computed(() => newMessageCount.value),
		isAtBottom: computed(() => isAtBottom.value),

		// Lifecycle
		cleanup,
	};
}
