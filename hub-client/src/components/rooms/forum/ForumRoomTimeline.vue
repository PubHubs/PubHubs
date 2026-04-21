<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-y-scroll p-4"
	>
		<div class="mb-2 flex items-center justify-between gap-2 px-5">
			<div class="flex items-center gap-2">
				<Button
					icon="plus"
					:variant="addNewThread ? 'primary' : 'secondary'"
					@click="toggleNewThread()"
					>{{ $t('message.forum.add_new_thread') }}</Button
				>
			</div>
			<div class="flex items-center gap-2">
				<span>{{ $t('message.forum.sortby') }}:</span>
				<Button
					v-for="order in ORDER"
					:key="order"
					:icon="orderIcon(order)"
					:variant="order === orderType ? 'primary' : 'secondary'"
					@click="setOrder(order)"
					>{{ $t('message.forum.sortby_' + order) }}</Button
				>
			</div>
		</div>

		<ForumCreateThread
			v-if="addNewThread"
			:id="room.roomId"
			@close="closeNewThread()"
		></ForumCreateThread>

		<div
			ref="elForumTimeline"
			class="relative min-h-0 flex-1 overflow-x-hidden overflow-y-scroll overscroll-y-contain"
			style="overflow-anchor: none"
		>
			<!-- Top sentinel -->
			<div
				ref="topSentinel"
				class="pointer-events-none h-[1px] shrink-0 opacity-0"
			/>

			<!-- Loading indicator -->
			<div class="flex h-full items-center justify-center px-4 md:px-16">
				<InlineSpinner v-if="!initialLoadComplete && events.length === 0" />
				<p
					v-else-if="initialLoadComplete && events.length === 0"
					class="text-on-surface-dim text-center"
				>
					{{ $t('messages.forum.no_threads') }}
				</p>
			</div>

			<ul
				v-if="events.length > 0"
				class="flex flex-col gap-y-2"
			>
				<li
					v-for="tEvent in events"
					:key="tEvent.event.matrixEvent.event.event_id"
					:data-thread-id="tEvent.event.matrixEvent.event.event_id"
				>
					<div>
						<ForumThreadItem
							:event="tEvent"
							:room="room"
							:show-actions="false"
							@click="closeNewThread()"
						></ForumThreadItem>
					</div>
				</li>
			</ul>

			<!-- Bottom sentinel -->
			<div
				ref="bottomSentinel"
				class="pointer-events-none h-[1px] shrink-0 opacity-0"
			/>
		</div>

		<JumpToBottomButton
			v-if="showJumpToBottomButton"
			:count="newMessageCount"
			@click="scrollToNewest"
		/>
	</div>
	<ForumThread
		v-if="currentTopic"
		:event="currentTopic"
		:room="room"
	></ForumThread>
</template>

<script setup lang="ts">
	// Packages
	import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Components
	import ForumCreateThread from '@hub-client/components/rooms/forum/ForumCreateThread.vue';
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import JumpToBottomButton from '@hub-client/components/ui/JumpToBottomButton.vue';

	// Composables
	import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';
	import { useTimelineScroll } from '@hub-client/composables/useTimelineScroll';

	// Logic
	import { ElementObserver } from '@hub-client/logic/core/elementObserver';

	import { TimelineScrollConstants } from '@hub-client/models/constants';
	// Models
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	import Button from '@hub-client/new-design/components/Button.vue';

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		topicId: {
			type: String,
			default: undefined,
		},
	});

	enum ORDER {
		Activity = 'activity',
		Created = 'created',
	}
	enum ORDER_DIR {
		desc = -1,
		asc = 1,
	}

	interface TimeLineEventWithLastTimestamp {
		event: TimelineEvent;
		timestamp: number;
	}

	const user = useUser();
	const elForumTimeline = ref<HTMLElement | null>(null);
	const topSentinel = ref<HTMLElement | null>(null);
	const bottomSentinel = ref<HTMLElement | null>(null);

	const { setupPaginationObserver, timelineVersion, refreshTimelineVersion } = useTimelinePagination(elForumTimeline, props.room);
	const { performInitialScroll, showJumpToBottomButton, newMessageCount, handleNewMessage } = useTimelineScroll(
		elForumTimeline,
		props.room,
		user.userId || '',
	);

	const addNewThread = ref(false);
	const orderType = ref(ORDER.Created);
	const orderDir = ref(ORDER_DIR.asc);
	const initialLoadComplete = ref(false);
	const { SCROLL_DEBOUNCE } = TimelineScrollConstants;
	let eventObserver: ElementObserver | null = null;
	let scrollDebounceId: number | null = null;

	defineExpose({ elForumTimeline });

	watch(
		() => props.room.getCurrentEvent(),
		() => {
			refreshTimelineVersion();
			setupEventIntersectionObserver();
		},
		{ deep: true },
	);

	onMounted(async () => {
		await nextTick();
		setupPaginationObserver(topSentinel, bottomSentinel);

		await nextTick();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await performInitialScroll({ explicitEventId: undefined, lastReadEventId: undefined });
		initialLoadComplete.value = true;

		setupEventIntersectionObserver();

		if (elForumTimeline.value) {
			elForumTimeline.value.addEventListener('scroll', debouncedScrollHandler, { passive: true });
		}
	});

	onBeforeUnmount(() => {
		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}
		elForumTimeline.value?.removeEventListener('scroll', debouncedScrollHandler);
		if (scrollDebounceId !== null) {
			clearTimeout(scrollDebounceId);
		}
	});

	const events = computed(() => {
		void timelineVersion.value; // Track timeline changes for reactivity
		const rawTimeline = props.room.getTimeline();
		let timelineWithTimeStamps = [] as TimeLineEventWithLastTimestamp[];
		timelineWithTimeStamps = rawTimeline.map((event) => {
			return {
				event: event,
				timestamp: props.room.getMatrixThreadLastEventTimestamp(event.matrixEvent.event.event_id!)!,
			} as TimeLineEventWithLastTimestamp;
		});
		// sort
		timelineWithTimeStamps.sort((a, b) => {
			if (orderType.value === ORDER.Created) {
				if (orderDir.value === ORDER_DIR.desc) {
					return a.event.matrixEvent.getTs() - b.event.matrixEvent.getTs();
				} else {
					return b.event.matrixEvent.getTs() - a.event.matrixEvent.getTs();
				}
			}
			if (orderType.value === ORDER.Activity) {
				if (orderDir.value === ORDER_DIR.asc) {
					return b.timestamp - a.timestamp;
				} else {
					return a.timestamp - b.timestamp;
				}
			}
			return 0;
		});
		return timelineWithTimeStamps;
	});

	const currentTopic = computed(() => {
		if (events.value.length > 0 && props.topicId) {
			const topic = events.value.find((t) => t.event.matrixEvent.event.event_id === props.topicId);
			return topic?.event.matrixEvent.event;
		}
		return undefined;
	});

	const orderIcon = (orderOption: ORDER): string => {
		if (orderOption === orderType.value) {
			if (orderDir.value === ORDER_DIR.asc) {
				return 'arrow-down';
			} else {
				return 'arrow-up';
			}
		}
		return '';
	};

	const setOrder = (orderOption: ORDER) => {
		if (orderOption === orderType.value) {
			orderDir.value = orderDir.value * -1;
		} else {
			if (orderType.value === ORDER.Activity) {
				orderType.value = ORDER.Created;
			} else {
				orderType.value = ORDER.Activity;
			}
		}
	};

	const toggleNewThread = () => {
		addNewThread.value = !addNewThread.value;
	};

	const closeNewThread = () => {
		addNewThread.value = false;
	};

	function scrollToNewest() {
		if (elForumTimeline.value) {
			elForumTimeline.value.scrollTop = elForumTimeline.value.scrollHeight;
		}
	}

	function debouncedScrollHandler() {
		if (scrollDebounceId !== null) {
			clearTimeout(scrollDebounceId);
		}
		scrollDebounceId = window.setTimeout(() => {
			handleScroll();
			scrollDebounceId = null;
		}, SCROLL_DEBOUNCE);
	}

	function handleScroll() {
		if (!elForumTimeline.value) return;
		const { scrollTop, scrollHeight, clientHeight } = elForumTimeline.value;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
		if (isAtBottom && newMessageCount.value > 0) {
			scrollToNewest();
		}
	}

	function setupEventIntersectionObserver() {
		if (eventObserver) {
			eventObserver.disconnectObserver();
		}
		const container = elForumTimeline.value;
		if (!container) return;
		const items = container.querySelectorAll<HTMLElement>('[data-thread-id]');
		const elements = Array.from(items).filter((el) => el.isConnected);
		eventObserver = new ElementObserver(elements, { threshold: 0.95 });
		eventObserver?.setUpObserver(handleVisibilityTracking);
	}

	function handleVisibilityTracking(entries: IntersectionObserverEntry[]) {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const threadId = entry.target.getAttribute('data-thread-id');
				if (threadId) {
					handleNewMessage(threadId, '');
				}
			}
		});
	}
</script>
