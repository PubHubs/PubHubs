<template>
	<div class="flex h-full flex-col">
		<!-- Loading indicator at top when loading older messages -->
		<div v-if="isLoadingPrevious" class="bg-surface flex w-full items-center justify-center py-3">
			<InlineSpinner class="mr-2" />
			<span class="text-on-surface-variant text-label-small">
				{{ $t('rooms.loading_older_messages') }}
			</span>
		</div>

		<div>
			<DateDisplayer v-if="settings.isFeatureEnabled(FeatureFlag.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()" />
		</div>

		<div v-if="room" ref="elRoomTimeline" class="relative flex flex-1 flex-col-reverse space-y-2 space-y-reverse overflow-x-hidden overflow-y-scroll pb-2">
			<!-- Bottom sentinel (for loading newer) - appears at visual bottom / DOM start -->
			<div ref="bottomSentinel" class="pointer-events-none !mb-0 h-[1px]" style="content-visibility: hidden"></div>

			<template v-if="reversedTimeline.length > 0">
				<div v-for="item in reversedTimeline" :key="item.matrixEvent.event.event_id">
					<div ref="elRoomEvent" :id="item.matrixEvent.event.event_id">
						<RoomMessageBubble
							:room="room"
							:event="item.matrixEvent.event"
							:event-thread-length="item.threadLength"
							:deleted-event="item.isDeleted"
							:data-event-id="item.matrixEvent.event.event_id"
							class="room-event"
							:class="{ 'animate-highlight': props.eventIdToScroll === item.matrixEvent.event.event_id }"
							:active-profile-card="activeProfileCard"
							:active-reaction-panel="activeReactionPanel"
							@in-reply-to-click="onInReplyToClick"
							@delete-message="confirmDeleteMessage(item.matrixEvent.event as TMessageEvent, item.isThreadRoot)"
							@edit-poll="onEditPoll"
							@edit-scheduler="onEditScheduler"
							@profile-card-toggle="toggleProfileCard"
							@profile-card-close="closeProfileCard"
							@reaction-panel-toggle="toggleReactionPanel"
							@reaction-panel-close="closeReactionPanel"
							@clicked-emoticon="sendEmoji"
						>
							<template #reactions>
								<div class="mt-2 ml-2 flex flex-wrap gap-2 px-20">
									<Reaction v-if="reactionExistsForMessage(item)" :reactEvent="onlyReactionEvent(item.matrixEvent.event.event_id!)" :messageEventId="item.matrixEvent.event.event_id!"></Reaction>
								</div>
							</template>
						</RoomMessageBubble>
						<LastReadMarker :currentEventId="item.matrixEvent.event.event_id ?? ''" :lastReadEventId="props.lastReadEventId" :room="props.room" />
					</div>
				</div>
			</template>

			<!-- Room created indicator - appears at visual top / DOM end -->
			<div v-if="oldestEventIsLoaded" class="border-on-surface-variant text-on-surface-variant text-label-small mx-auto my-4 flex w-60 items-center justify-center rounded-xl border px-4">
				{{ $t('rooms.roomCreated') }}
			</div>

			<!-- Top sentinel (for loading older) - appears at visual top / DOM end -->
			<div ref="topSentinel" class="pointer-events-none !mt-0 h-[1px]" style="content-visibility: hidden"></div>
		</div>

		<!-- Loading indicator at bottom when loading newer messages -->
		<div v-if="isLoadingNext" class="bg-surface flex w-full items-center justify-center py-3">
			<InlineSpinner class="mr-2" />
			<span class="text-on-surface-variant text-label-small">
				{{ $t('rooms.loading_newer_messages') }}
			</span>
		</div>

		<!-- Priority: New messages button > Jump to bottom button -->
		<NewMessagesButton v-if="showIndicator" :count="newMessageCount" @click="scrollToNewestMessages" />
		<JumpToBottomButton v-else-if="showJumpToBottom" @click="scrollToBottom" />
		<MessageInput class="z-10" v-if="room" :room="room" :in-thread="false" :editing-poll="editingPoll" :editing-scheduler="editingScheduler"></MessageInput>
	</div>
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="rooms.currentRoom" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage" />
</template>

<script setup lang="ts">
	import { EventType } from 'matrix-js-sdk';
	import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Components
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import DateDisplayer from '@hub-client/components/ui/DateDisplayer.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import JumpToBottomButton from '@hub-client/components/ui/JumpToBottomButton.vue';
	import LastReadMarker from '@hub-client/components/ui/LastReadMarker.vue';
	import NewMessagesButton from '@hub-client/components/ui/NewMessagesButton.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Composables
	import { useInitialScroll } from '@hub-client/composables/useInitialScroll';
	import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';
	import { useTimelineObservers } from '@hub-client/composables/useTimelineObservers';
	import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';
	import { useTimelineScroll } from '@hub-client/composables/useTimelineScroll';
	import { useVisibleEvents } from '@hub-client/composables/useVisibleEvents';

	// Logic
	import { ElementObserver } from '@hub-client/logic/core/elementObserver';
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { RelationType, ScrollPosition } from '@hub-client/models/constants';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const pubhubs = usePubhubsStore();
	const elRoomTimeline = ref<HTMLElement | null>(null);
	const elRoomEvent = ref<HTMLElement | null>(null);
	const topSentinel = ref<HTMLElement | null>(null);
	const bottomSentinel = ref<HTMLElement | null>(null);
	const showConfirmDelMsgDialog = ref(false);
	const activeProfileCard = ref<string | null>(null);
	const activeReactionPanel = ref<string | null>(null);
	const eventToBeDeleted = ref<TMessageEvent>();
	const editingPoll = ref<{ poll: Poll; eventId: string } | undefined>(undefined);
	const editingScheduler = ref<{ scheduler: Scheduler; eventId: string } | undefined>(undefined);

	const DELAY_RECEIPT_MESSAGE = 5000;
	const DELAY_WAIT_OBSERVING = 100;

	let dateInformation = ref<number>(0);
	let eventToBeDeletedIsThreadRoot: boolean = false;

	let eventObserver: ElementObserver | null = null;

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		eventIdToScroll: {
			type: String,
		},
		lastReadEventId: {
			type: String,
			default: undefined,
		},
	});

	// Initialize composables
	const { scrollToEvent, scrollToBottom, isScrolling, showIndicator, newMessageCount, resetCount, handleNewMessage, isAtBottom, showJumpToBottom } = useTimelineScroll(elRoomTimeline, props.room, user.userId || '');
	const { loadPrevious, loadNext, isLoadingPrevious, isLoadingNext, oldestEventIsLoaded, newestEventIsLoaded } = useTimelinePagination(elRoomTimeline, props.room);
	const { setupPaginationObserver, setupRelatedEventsObserver, updateRelatedEventsObserver } = useTimelineObservers(elRoomTimeline);
	const { performInitialScroll, isInitialScrollComplete } = useInitialScroll(props.room.roomId, props.room, scrollToEvent);
	const { getLastVisibleEventId } = useVisibleEvents(elRoomTimeline);
	const { setLastReadMessage } = useLastReadMessages();

	const userHasScrolled = computed(() => !isScrolling.value);

	/**
	 * Original timeline in chronological order [oldest, ..., newest]
	 */
	const roomTimeLine = computed(() => {
		return props.room.getTimeline();
	});

	/**
	 * Reversed timeline for column-reverse rendering [newest, ..., oldest]
	 */
	const reversedTimeline = computed(() => {
		return [...roomTimeLine.value].reverse();
	});

	defineExpose({ elRoomTimeline });

	onBeforeUnmount(() => {
		// Save last visible event before DOM is destroyed
		const lastEventId = props.room.getLastVisibleEventId() || getLastVisibleEventId();
		if (lastEventId) {
			const event = props.room.findEventById(lastEventId);
			if (event) {
				const timestamp = event.localTimestamp || event.getTs?.() || Date.now();
				setLastReadMessage(props.room.roomId, lastEventId, timestamp);
			}
		}

		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}
	});

	onMounted(async () => {
		LOGGER.log(SMI.ROOM_TIMELINE, `onMounted RoomTimeline`, { roomId: props.room.roomId });

		await rooms.storeRoomNotice(props.room.roomId);

		// Setup observers
		setupPaginationObserver(topSentinel, bottomSentinel, {
			onLoadPrevious: loadPrevious,
			onLoadNext: loadNext,
		});

		setupRelatedEventsObserver((eventIds) => {
			props.room.fetchRelatedEvents(eventIds);
		});

		// Wait for DOM render
		await nextTick();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		// Wait for timeline events
		let attempts = 0;
		while (roomTimeLine.value.length === 0 && attempts < 20) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			attempts++;
		}

		if (roomTimeLine.value.length === 0) {
			LOGGER.warn(SMI.ROOM_TIMELINE, 'Timeline still empty after waiting');
			return;
		}

		// Perform initial scroll
		await performInitialScroll({
			explicitEventId: props.eventIdToScroll,
			lastReadEventId: props.lastReadEventId,
		});

		setupEventIntersectionObserver();
	});

	watch(() => roomTimeLine.value.length, onTimelineChange);

	watch(
		() => props.eventIdToScroll,
		(eventId) => {
			if (!eventId) return;
			scrollToEvent(eventId, { position: ScrollPosition.Center, highlight: true });
		},
	);

	watch(
		() => props.room.getCurrentEvent(),
		() => setupEventIntersectionObserver(),
		{ deep: true },
	);

	function onlyReactionEvent(eventId: string) {
		props.room.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation }).forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent.matrixEvent));
		return props.room.getCurrentEventRelatedEvents();
	}

	function reactionExistsForMessage(timelineEvent: TimelineEvent): boolean {
		if (timelineEvent.isDeleted || (timelineEvent.matrixEvent && timelineEvent.matrixEvent.isRedacted())) return false;
		const messageEventId = timelineEvent.matrixEvent.event.event_id;
		if (!messageEventId) return false;

		const reactionEvent = onlyReactionEvent(messageEventId).find((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			return relatesTo && relatesTo.event_id === messageEventId;
		});

		if (reactionEvent) {
			const relatesTo = reactionEvent.getContent()[RelationType.RelatesTo];
			return relatesTo?.key ? true : false;
		}

		return false;
	}

	async function sendEmoji(emoji: string, eventId: string) {
		await pubhubs.addReactEvent(props.room.roomId, eventId, emoji);
	}

	function setupEventIntersectionObserver() {
		eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

		if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
			eventObserver?.setUpObserver(handlePrivateReceipt);
		}
		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);
	}

	const handlePrivateReceipt = (entries: IntersectionObserverEntry[]) => {
		if (entries.length < 1) return;

		console.warn('[handlePrivateReceipt] Called with', entries.length, 'entries');

		// Find the newest visible message from entries
		let newestVisibleEventId: string | null = null;
		let newestVisibleTimestamp = 0;

		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);
			if (matrixEvent && matrixEvent.getType() === EventType.RoomMessage) {
				// Track for internal state
				if (props.room.getLastVisibleTimeStamp() < matrixEvent.localTimestamp) {
					props.room.setLastVisibleEventId(eventId);
					props.room.setLastVisibleTimeStamp(matrixEvent.localTimestamp);
				}
				// Track newest for receipt
				if (matrixEvent.localTimestamp > newestVisibleTimestamp) {
					newestVisibleTimestamp = matrixEvent.localTimestamp;
					newestVisibleEventId = eventId;
				}
			}
		});

		if (!newestVisibleEventId) {
			console.warn('[handlePrivateReceipt] No newest visible event found');
			return;
		}

		const capturedEventId = newestVisibleEventId;
		console.warn('[handlePrivateReceipt] Will send receipt for', capturedEventId, 'in 5 seconds');

		// After 5 seconds of visibility, send read receipt
		setTimeout(async () => {
			// Check if this message is still visible
			const element = elRoomTimeline.value?.querySelector(`[id="${capturedEventId}"]`);
			if (!element || !elRoomTimeline.value) {
				console.warn('[handlePrivateReceipt] Element not found after timeout');
				return;
			}

			const containerRect = elRoomTimeline.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const isStillVisible = elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.top;

			if (!isStillVisible) {
				console.warn('[handlePrivateReceipt] Element no longer visible after timeout');
				return;
			}

			console.warn('[handlePrivateReceipt] Sending receipt for', capturedEventId);
			const lastVisibleEvent = props.room.findEventById(capturedEventId);
			if (lastVisibleEvent) {
				await pubhubs.sendPrivateReceipt(lastVisibleEvent);
			}
		}, DELAY_RECEIPT_MESSAGE);
	};

	const handleDateDisplayer = (entries: IntersectionObserverEntry[]) => {
		props.room.resetFirstVisibleEvent();
		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);
			if (matrixEvent && matrixEvent.getType() === EventType.RoomMessage) {
				if (props.room.getFirstVisibleTimeStamp() < matrixEvent.localTimestamp || props.room.getFirstVisibleTimeStamp() === 0) {
					matrixEvent.event.event_id && props.room.setFirstVisibleEventId(matrixEvent.event.event_id);
					props.room.setFirstVisibleTimeStamp(matrixEvent.localTimestamp);
				}
			}
		});
		const minTimeStamp = props.room.getFirstVisibleEventId();
		const firstReadEvent = props.room.findEventById(minTimeStamp);
		if (!firstReadEvent || firstReadEvent?.localTimestamp === 0) {
			return;
		}
		dateInformation.value = firstReadEvent?.localTimestamp;
	};

	async function onTimelineChange(newTimelineLength?: number, oldTimelineLength?: number) {
		if (typeof newTimelineLength !== 'number' || newTimelineLength < 0 || typeof oldTimelineLength !== 'number' || oldTimelineLength < 0) return;
		if (!elRoomTimeline.value) return;

		await rooms.waitForInitialRoomsLoaded();

		if (!rooms.currentRoom) return;
		if (!newestEventIsLoaded.value) return;

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange`, { newTimelineLength, oldTimelineLength });

		// Notify scroll composable about new messages (for indicator)
		if (newTimelineLength > oldTimelineLength && oldTimelineLength > 0) {
			const timeline = props.room.getTimeline();
			const newMessages = timeline.slice(oldTimelineLength);

			newMessages.forEach((item) => {
				const eventId = item.matrixEvent.event.event_id;
				const senderId = item.matrixEvent.event.sender;
				if (eventId && senderId) {
					handleNewMessage(eventId, senderId);
				}
			});
		}

		const lastEventMsgType = props.room.getLiveTimelineEvents().at(-1)?.getContent().msgtype;
		if (typeof lastEventMsgType === 'string') {
			if (lastEventMsgType in PubHubsInvisibleMsgType) {
				return;
			}
		}

		let newestEventId = props.room.getRoomNewestMessageId();

		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);

		if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
			if (!eventObserver || !elRoomEvent.value) {
				eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });
			}

			if (newestEventId?.substring(0, 1) === '~') {
				waitObservingEvent();
			} else {
				nextTick();
				eventObserver = new ElementObserver(elRoomEvent.value!, { threshold: 0.95 });
				eventObserver?.setUpObserver(handlePrivateReceipt);
			}
		}

		// If initial scroll hasn't happened yet and events just loaded, perform it now
		if (!isInitialScrollComplete.value && oldTimelineLength === 0 && newTimelineLength > 0) {
			await performInitialScroll({
				explicitEventId: props.eventIdToScroll,
				lastReadEventId: props.lastReadEventId,
			});
			return;
		}

		// Auto-scroll to user's own messages after initial scroll is complete
		if (newestEventId && isInitialScrollComplete.value) {
			const newestEvent = props.room.getLiveTimelineNewestEvent();
			if (newestEvent && newestEvent.sender === user.userId) {
				scrollToBottom();
			}
		}

		// Update related events observer
		const eventIds = roomTimeLine.value.map((x) => x.matrixEvent.event.event_id || '').filter(Boolean);
		updateRelatedEventsObserver(eventIds);

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended`);
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: ScrollPosition.Center, highlight: true });
	}

	async function scrollToNewestMessages() {
		scrollToBottom();
		resetCount();
	}

	function onEditPoll(poll: Poll, eventId: string) {
		editingPoll.value = { poll, eventId };
	}

	function onEditScheduler(scheduler: Scheduler, eventId: string) {
		editingScheduler.value = { scheduler, eventId };
	}

	function toggleProfileCard(eventId: string) {
		activeProfileCard.value = activeProfileCard.value === eventId ? null : eventId;
	}

	function closeProfileCard() {
		activeProfileCard.value = null;
	}

	function toggleReactionPanel(eventId: string) {
		activeReactionPanel.value = activeReactionPanel.value === eventId ? null : eventId;
	}

	function closeReactionPanel() {
		activeReactionPanel.value = null;
	}

	function confirmDeleteMessage(event: TMessageEvent, isThreadRoot: boolean) {
		showConfirmDelMsgDialog.value = true;
		eventToBeDeleted.value = event;
		eventToBeDeletedIsThreadRoot = isThreadRoot;
	}

	async function deleteMessage() {
		if (eventToBeDeleted.value) {
			rooms.currentRoom?.deleteMessage(eventToBeDeleted.value, eventToBeDeletedIsThreadRoot);
			LOGGER.log(SMI.ROOM_TIMELINE, `Deleted message with id ${eventToBeDeleted.value.event_id}`, { eventToBeDeleted });
		}
	}

	function waitObservingEvent() {
		let timer = setInterval(function () {
			if (props.room.getLiveTimelineNewestEvent()?.event_id?.substring(0, 1) !== '~') {
				eventObserver?.setUpObserver(handlePrivateReceipt);
				clearInterval(timer);
			}
		}, DELAY_WAIT_OBSERVING);
	}
</script>
