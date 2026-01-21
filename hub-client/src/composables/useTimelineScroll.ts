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

const { SCROLL_THRESHOLD, SCROLL_DEBOUNCE, TOP_PADDING } = TimelineScrollConstants;

export function useTimelineScroll(container: Ref<HTMLElement | null>, room: Room, currentUserId: string) {
	// Core state
	const isAtNewest = ref(true);
	const newMessageCount = ref(0);
	const isInitialScrollComplete = ref(false);

	// Scroll tracking
	let scrollTimeoutId: number | null = null;
	let lastScrollTop = 0;

	/**
	 * Checks if user is at newest messages (visual bottom)
	 * In column-reverse: scrollTop near 0 = at newest
	 */
	function checkIsAtNewest(): boolean {
		if (!container.value) return true;
		return container.value.scrollTop <= SCROLL_THRESHOLD;
	}

	/**
	 * Handles scroll events (debounced)
	 */
	function handleScroll() {
		if (!container.value) return;

		lastScrollTop = container.value.scrollTop;

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

				// Wait for Vue to render the DOM after loading
				await nextTick();
				await new Promise((resolve) => requestAnimationFrame(resolve));

				// Retry finding the element a few times
				for (let i = 0; i < 5 && !element; i++) {
					element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;
					if (!element) {
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
				}
			} catch (error) {
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`, { error });
				throw error;
			}
		}

		if (!element) {
			LOGGER.warn(SMI.ROOM_TIMELINE, `Event ${eventId} not found after loading`);
			throw new Error(`Event ${eventId} not found`);
		}

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
			const containerRect = container.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const currentScrollTop = container.value.scrollTop;

			const scrollTarget = currentScrollTop + (elementRect.top - containerRect.top - TOP_PADDING);
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;

			container.value.scrollTo({
				top: Math.max(0, Math.min(scrollTarget, maxScroll)),
				behavior,
			});
			isAtNewest.value = checkIsAtNewest();
		} else {
			// ScrollPosition.Center - center the element in viewport
			const containerRect = container.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const currentScrollTop = container.value.scrollTop;

			const elementCenter = elementRect.top + elementRect.height / 2;
			const containerCenter = containerRect.top + containerRect.height / 2;
			let scrollTarget = currentScrollTop + elementCenter - containerCenter;

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
	function handleNewMessage(eventId: string, senderId: string) {
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
	}

	/**
	 * Performs initial scroll based on priority system
	 *
	 * Priority 1: Explicit eventId (from search, navigation)
	 * Priority 2: Last read message (returning to room)
	 * Priority 3: Default to newest (first visit)
	 */
	async function performInitialScroll(params: InitialScrollParams = {}): Promise<void> {
		try {
			// Priority 1: Explicit eventId (from search, navigation)
			if (params.explicitEventId) {
				try {
					await scrollToEvent(params.explicitEventId, {
						position: ScrollPosition.Center,
						behavior: ScrollBehavior.Smooth,
						highlight: true,
					});
				} catch {
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
				const newestEventId = room.getTimelineNewestMessageEventId();
				const isNearEnd = newestEventId ? isEventNearNewest(params.lastReadEventId, newestEventId) : false;

				if (newestEventId) {
					if (isNearEnd) {
						// Near end - just scroll to newest
						await scrollToEvent(newestEventId, {
							position: ScrollPosition.End,
							behavior: ScrollBehavior.Auto,
						});
					} else {
						// Far from end - try to scroll to last read with padding
						try {
							await scrollToEvent(params.lastReadEventId, {
								position: ScrollPosition.TopWithPadding,
								behavior: ScrollBehavior.Auto,
							});
						} catch {
							// Last read event not found - fall back to newest
							await scrollToEvent(newestEventId, {
								position: ScrollPosition.End,
								behavior: ScrollBehavior.Auto,
							});
						}
					}
				}
				isInitialScrollComplete.value = true;
				return;
			}

			// Priority 3: Default to newest (first visit)
			const newestEventId = room.getTimelineNewestMessageEventId();
			if (newestEventId) {
				await scrollToEvent(newestEventId, {
					position: ScrollPosition.End,
					behavior: ScrollBehavior.Auto,
				});
			}
			isInitialScrollComplete.value = true;
		} catch {
			isInitialScrollComplete.value = true;
		}
	}

	/**
	 * Checks if an event is near the newest message
	 * Used to decide whether to scroll to last read or just go to newest
	 */
	function isEventNearNewest(eventId: string, newestEventId: string): boolean {
		const timeline = room.getTimeline();
		const eventIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === eventId);
		const newestIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === newestEventId);

		if (eventIndex === -1 || newestIndex === -1) {
			return false;
		}

		const messagesBetween = newestIndex - eventIndex;
		return messagesBetween <= TimelineScrollConstants.NEAR_END_THRESHOLD;
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
			lastScrollTop = container.value.scrollTop;
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
		return !isAtNewest.value && newMessageCount.value === 0;
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
