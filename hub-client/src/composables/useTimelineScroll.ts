/**
 * Timeline Scroll Composable
 *
 * Manages scroll behavior for a column-reverse timeline container.
 *
 * IMPORTANT: This uses flex-direction: column-reverse, which means:
 * - scrollTop = 0 → visual bottom (newest messages)
 * - scrollTop = max → visual top (oldest messages)
 * - Content added at DOM start appears at visual bottom (no viewport shift)
 * - Content added at DOM end appears at visual top (may need scroll adjustment)
 */
import { type Ref, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

import { ScrollBehavior, ScrollPosition } from '@hub-client/models/constants';
import type { TCurrentEvent } from '@hub-client/models/events/types';
import type Room from '@hub-client/models/rooms/Room';

export interface ScrollOptions {
	position: ScrollPosition.Start | ScrollPosition.Center | ScrollPosition.End | ScrollPosition.TopWithPadding;
	behavior?: ScrollBehavior.Smooth | ScrollBehavior.Auto;
	highlight?: boolean;
}

// How close to scrollTop=0 counts as "at bottom" (in pixels)
const BOTTOM_THRESHOLD = 50;
const SCROLL_TIMEOUT = 200;
// Padding from top edge when using TopWithPadding scroll position
const TOP_PADDING = 80;

export function useTimelineScroll(container: Ref<HTMLElement | null>, room: Room, currentUserId: string) {
	const isScrolling = ref(false);
	const scrollDirection = ref<'up' | 'down' | null>(null);

	// New messages indicator state
	const isAtBottom = ref(true);
	const newMessageCount = ref(0);
	const lastSeenEventId = ref<string | null>(null);

	let scrollTimeoutId: number | null = null;
	let lastScrollTop = 0;

	/**
	 * Checks if user is at the bottom (newest messages visible)
	 *
	 * With column-reverse: scrollTop = 0 means at the visual bottom
	 */
	function checkIfAtBottom(): boolean {
		if (!container.value) return true;
		const { scrollTop } = container.value;
		// In column-reverse, scrollTop near 0 = at the bottom
		return scrollTop <= BOTTOM_THRESHOLD;
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
	 */
	const handleScroll = () => {
		if (!container.value) return;

		const currentScrollTop = container.value.scrollTop;

		// In column-reverse: scrollTop increasing = scrolling towards older (visual up)
		scrollDirection.value = currentScrollTop > lastScrollTop ? 'up' : 'down';
		lastScrollTop = currentScrollTop;

		isScrolling.value = true;

		const wasAtBottom = isAtBottom.value;
		isAtBottom.value = checkIfAtBottom();

		// If user just scrolled to bottom, reset count
		if (!wasAtBottom && isAtBottom.value) {
			resetCount();
		}

		// Update last seen event when at bottom
		if (isAtBottom.value) {
			const newestEventId = room.getTimelineNewestMessageEventId();
			if (newestEventId) {
				lastSeenEventId.value = newestEventId;
			}
		}

		// Clear existing timeout
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
		}

		// Set new timeout to detect when scrolling stops
		scrollTimeoutId = window.setTimeout(() => {
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
	 *
	 * With column-reverse coordinate system:
	 * - ScrollPosition.End → scrollTo({ top: 0 }) to show newest/bottom
	 * - ScrollPosition.Start → scrollTo({ top: maxScroll }) to show oldest/top
	 * - ScrollPosition.Center → calculate to center the element
	 */
	async function scrollToEvent(eventId: string, options: ScrollOptions = { position: ScrollPosition.Center }): Promise<void> {
		LOGGER.log(SMI.ROOM_TIMELINE, `Scrolling to event: ${eventId}`, { eventId, position: options.position });

		if (!container.value) {
			throw new Error('Container not mounted');
		}

		// Try to find element in current timeline
		let element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;

		// If not found, try to load it
		if (!element) {
			try {
				const currentEvent: TCurrentEvent = { eventId };
				await room.loadToEvent(currentEvent);
				element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
			} catch (error) {
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`, { error });
				throw error;
			}
		}

		if (!element) {
			LOGGER.warn(SMI.ROOM_TIMELINE, `Event ${eventId} not found after loading`);
			return;
		}

		const behavior = options.behavior ?? ScrollBehavior.Smooth;

		if (options.position === ScrollPosition.End) {
			// Scroll to bottom (newest) - in column-reverse, this is scrollTop = 0
			container.value.scrollTo({ top: 0, behavior });
		} else if (options.position === ScrollPosition.Start) {
			// Scroll to top (oldest) - in column-reverse, this is scrollTop = max
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			container.value.scrollTo({ top: maxScroll, behavior });
		} else if (options.position === ScrollPosition.TopWithPadding) {
			// Position element near top of viewport with padding
			// Used for last read message so unread messages are visible below
			const containerRect = container.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const currentScrollTop = container.value.scrollTop;

			// Calculate scroll to position element at top + padding
			const scrollTarget = currentScrollTop + (elementRect.top - containerRect.top - TOP_PADDING);

			// Clamp to valid range
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			container.value.scrollTo({
				top: Math.max(0, Math.min(scrollTarget, maxScroll)),
				behavior,
			});
		} else {
			// ScrollPosition.Center - center the element in viewport
			const containerRect = container.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const currentScrollTop = container.value.scrollTop;

			const elementCenter = elementRect.top + elementRect.height / 2;
			const containerCenter = containerRect.top + containerRect.height / 2;
			let scrollTarget = currentScrollTop + elementCenter - containerCenter;

			// Clamp to valid range
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

			container.value.scrollTo({ top: scrollTarget, behavior });
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
	 * Scrolls to bottom (newest messages)
	 */
	function scrollToBottom() {
		if (!container.value) return;
		// In column-reverse, bottom is scrollTop = 0
		container.value.scrollTo({ top: 0, behavior: 'smooth' });
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
		// Don't count if user is at bottom
		if (isAtBottom.value) {
			lastSeenEventId.value = eventId;
			return;
		}

		// Don't count user's own messages
		if (senderId === currentUserId) {
			return;
		}

		// Increment count
		newMessageCount.value++;
	}

	/**
	 * Set up scroll listener on mount
	 */
	onMounted(() => {
		if (container.value) {
			container.value.addEventListener('scroll', handleScroll, { passive: true });
			lastScrollTop = container.value.scrollTop;
			// Initial check
			isAtBottom.value = checkIfAtBottom();
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

	/**
	 * Whether to show the jump to bottom button (when scrolled up but no new messages)
	 */
	const showJumpToBottom = computed(() => {
		return !isAtBottom.value && newMessageCount.value === 0;
	});

	return {
		// Operations
		scrollToEvent,
		scrollToBottom,
		isEventVisible,
		resetCount,
		handleNewMessage,

		// State
		isScrolling: computed(() => isScrolling.value),
		scrollDirection: computed(() => scrollDirection.value),

		// New messages indicator
		showIndicator,
		newMessageCount: computed(() => newMessageCount.value),
		isAtBottom: computed(() => isAtBottom.value),

		// Jump to bottom (when scrolled up but no new messages)
		showJumpToBottom,

		// Lifecycle
		cleanup,
	};
}
