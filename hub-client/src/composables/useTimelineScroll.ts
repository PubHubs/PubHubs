// Packages
import { type Ref, computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { ScrollBehavior, ScrollPosition, TimelineScrollConstants } from '@hub-client/models/constants';
import type { TCurrentEvent } from '@hub-client/models/events/types';
import type Room from '@hub-client/models/rooms/Room';

// Types
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
	const isAtNewest = ref(true);
	const newMessageCount = ref(0);
	const isInitialScrollComplete = ref(false);
	let scrollTimeoutId: number | null = null;

	function checkIsAtNewest(): boolean {
		if (!container.value) return true;
		return container.value.scrollTop >= -SCROLL_THRESHOLD;
	}

	function handleScroll() {
		if (!container.value) return;

		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
		}

		scrollTimeoutId = window.setTimeout(() => {
			const wasAtNewest = isAtNewest.value;
			isAtNewest.value = checkIsAtNewest();

			if (!wasAtNewest && isAtNewest.value) {
				newMessageCount.value = 0;
			}

			scrollTimeoutId = null;
		}, SCROLL_DEBOUNCE);
	}

	function scrollToNewest() {
		if (!container.value) return;
		container.value.scrollTo({ top: 0, behavior: 'smooth' });
		isAtNewest.value = true;
		newMessageCount.value = 0;
	}

	function applyHighlight(element: HTMLElement) {
		element.classList.add('highlighted');
		window.setTimeout(() => {
			element.classList.add('unhighlighted');
			window.setTimeout(() => {
				element.classList.remove('highlighted', 'unhighlighted');
			}, 500);
		}, 2000);
	}

	async function scrollToEvent(eventId: string, options: ScrollOptions = { position: ScrollPosition.Center }): Promise<void> {
		if (!container.value) {
			throw new Error('Container not mounted');
		}

		let element = container.value.querySelector(`[id="${eventId}"]`) as HTMLElement | null;

		if (!element) {
			try {
				const currentEvent: TCurrentEvent = { eventId };
				await room.loadToEvent(currentEvent);

				await nextTick();
				await new Promise((resolve) => requestAnimationFrame(resolve));

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
			container.value.scrollTo({ top: 0, behavior });
			isAtNewest.value = true;
		} else if (options.position === ScrollPosition.Start) {
			const maxScroll = container.value.scrollHeight - container.value.clientHeight;
			container.value.scrollTo({ top: maxScroll, behavior });
			isAtNewest.value = false;
		} else if (options.position === ScrollPosition.TopWithPadding) {
			element.scrollIntoView({ block: 'start', behavior });

			await new Promise((resolve) => setTimeout(resolve, behavior === 'smooth' ? 300 : 50));

			const elementTop = element.getBoundingClientRect().top;
			const containerTop = container.value.getBoundingClientRect().top;
			const targetTop = containerTop + 10;

			if (elementTop < targetTop) {
				const adjustment = targetTop - elementTop;
				container.value.scrollTop += adjustment;
			}

			isAtNewest.value = checkIsAtNewest();
		} else {
			// ScrollPosition.Center - use scrollIntoView which handles flex-col-reverse correctly
			element.scrollIntoView({ block: 'center', behavior });
			isAtNewest.value = checkIsAtNewest();
		}

		const waitTime = behavior === ScrollBehavior.Smooth ? 300 : 50;
		await new Promise((resolve) => setTimeout(resolve, waitTime));

		if (options.highlight && element) {
			applyHighlight(element);
		}
	}

	function handleNewMessage(_eventId: string, senderId: string) {
		if (senderId === currentUserId) {
			scrollToNewest();
			return;
		}

		if (isAtNewest.value) {
			// Auto-scroll to show new message when caught up
			scrollToNewest();
			return;
		}

		newMessageCount.value++;
	}

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
				const timeline = room.getChronologicalTimeline();
				const lastReadIndex = timeline.findIndex((e) => e.matrixEvent.event.event_id === params.lastReadEventId);
				const newestIndex = timeline.length - 1;

				if (lastReadIndex !== -1 && newestIndex > lastReadIndex) {
					newMessageCount.value = newestIndex - lastReadIndex;
				}

				try {
					await scrollToEvent(params.lastReadEventId, {
						position: ScrollPosition.TopWithPadding,
						behavior: ScrollBehavior.Auto,
					});
				} catch {
					newMessageCount.value = 0;
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

	function resetInitialScroll() {
		isInitialScrollComplete.value = false;
	}

	onMounted(() => {
		if (container.value) {
			container.value.addEventListener('scroll', handleScroll, { passive: true });
			isAtNewest.value = checkIsAtNewest();
		}
	});

	function cleanup() {
		container.value?.removeEventListener('scroll', handleScroll);
		if (scrollTimeoutId !== null) {
			clearTimeout(scrollTimeoutId);
			scrollTimeoutId = null;
		}
	}

	onBeforeUnmount(cleanup);

	const showNewMessagesButton = computed(() => {
		return !isAtNewest.value && newMessageCount.value > 0;
	});

	const showJumpToBottomButton = computed(() => {
		return !isAtNewest.value;
	});

	return {
		scrollToEvent,
		scrollToNewest,
		performInitialScroll,
		resetInitialScroll,
		handleNewMessage,
		isAtNewest: computed(() => isAtNewest.value),
		newMessageCount: computed(() => newMessageCount.value),
		isInitialScrollComplete: computed(() => isInitialScrollComplete.value),
		showNewMessagesButton,
		showJumpToBottomButton,
		cleanup,
	};
}
