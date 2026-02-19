<template>
	<div class="flex h-full flex-col">
		<div class="shrink-0">
			<DateDisplayer v-if="settings.isFeatureEnabled(FeatureFlag.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()" />
		</div>

		<div class="relative min-h-0 flex-1">
			<div v-if="room" ref="elRoomTimeline" class="flex h-full flex-col-reverse space-y-reverse overflow-x-hidden overflow-y-scroll overscroll-y-contain" style="overflow-anchor: none">
				<!-- Bottom sentinel (appears at visual bottom, near newest messages) -->
				<div ref="bottomSentinel" class="pointer-events-none mb-0! h-[1px] shrink-0 opacity-0"></div>

				<!-- Expands if the timeline height < the vieport, to top-align the content -->
				<div class="flex h-full items-center justify-center px-4 md:px-16">
					<P v-if="initialLoadComplete && reversedTimeline.length === 0" class="text-on-surface-dim text-center">
						{{ $t('rooms.no_messages_yet') }}
					</P>
				</div>

				<template v-if="reversedTimeline.length > 0">
					<div v-for="item in reversedTimeline" :key="item.matrixEvent.event.event_id">
						<div ref="elRoomEvent" :id="item.matrixEvent.event.event_id">
							<RoomMessageBubble
								class="room-event"
								:room="room"
								:event="item.matrixEvent.event"
								:event-thread-length="item.threadLength"
								:deleted-event="item.isDeleted"
								:data-event-id="item.matrixEvent.event.event_id"
								:class="props.eventIdToScroll === item.matrixEvent.event.event_id && 'animate-highlight'"
								:active-reaction-panel="activeReactionPanel"
								@in-reply-to-click="onInReplyToClick"
								@delete-message="confirmDeleteMessage(item.matrixEvent.event as TMessageEvent, item.isThreadRoot)"
								@edit-poll="onEditPoll"
								@edit-scheduler="onEditScheduler"
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
							<LastReadMarker :currentEventId="item.matrixEvent.event.event_id ?? ''" :lastReadEventId="displayedReadMarker ?? undefined" :room="props.room" />
						</div>
					</div>
				</template>

				<!-- Room created indicator-->
				<div v-if="oldestEventIsLoaded" class="text-label-tiny border-on-surface-dim text-on-surface rounded-base px-075 py-025 pt-050 mx-auto my-2 flex w-fit items-center justify-center gap-2 border uppercase">
					{{ $t('rooms.roomCreated') }}
				</div>

				<!-- Top sentinel (appears at visual top, near oldest messages) -->
				<div ref="topSentinel" class="pointer-events-none mt-0! h-[1px] shrink-0 opacity-0"></div>
			</div>

			<JumpToBottomButton v-if="showJumpToBottomButton" :count="newMessageCount" @click="scrollToNewest" />
		</div>

		<MessageInput class="z-10 shrink-0" v-if="room" :room="room" :in-thread="false" :editing-poll="editingPoll" :editing-scheduler="editingScheduler" />
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
	import JumpToBottomButton from '@hub-client/components/ui/JumpToBottomButton.vue';
	import LastReadMarker from '@hub-client/components/ui/LastReadMarker.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Composables
	import useReadMarker from '@hub-client/composables/useReadMarker';
	import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';
	import { useTimelineScroll } from '@hub-client/composables/useTimelineScroll';

	// Logic
	import { ElementObserver } from '@hub-client/logic/core/elementObserver';
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { RelationType, ScrollPosition, TimelineScrollConstants } from '@hub-client/models/constants';
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
	const activeReactionPanel = ref<string | null>(null);
	const eventToBeDeleted = ref<TMessageEvent>();
	const editingPoll = ref<{ poll: Poll; eventId: string } | undefined>(undefined);
	const editingScheduler = ref<{ scheduler: Scheduler; eventId: string } | undefined>(undefined);
	const initialLoadComplete = ref(false);

	const { READ_DELAY_MS, PAGINATION_COOLDOWN } = TimelineScrollConstants;

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
	const { scrollToEvent, scrollToNewest, performInitialScroll, handleNewMessage, isInitialScrollComplete, showJumpToBottomButton, newMessageCount } = useTimelineScroll(elRoomTimeline, props.room, user.userId || '');
	const { setupPaginationObserver, isLoadingPrevious, isLoadingNext, oldestEventIsLoaded, newestEventIsLoaded, timelineVersion, refreshTimelineVersion } = useTimelinePagination(elRoomTimeline, props.room);
	const { displayedReadMarker, initialize: initializeReadMarker, update: updateReadMarker } = useReadMarker(props.room, user.userId || '');
	const userHasScrolled = ref(true);

	/**
	 * Timeline in reverse order [newest, ..., oldest] for column-reverse rendering
	 */
	const reversedTimeline = computed(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		timelineVersion.value; // Dependency to trigger re-computation
		return [...props.room.getChronologicalTimeline()].reverse();
	});

	/**
	 * Timeline in chronological order [oldest, ..., newest]
	 */
	const roomTimeLine = computed(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		timelineVersion.value; // Dependency to trigger re-computation
		return props.room.getChronologicalTimeline();
	});

	defineExpose({ elRoomTimeline });

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (activeReactionPanel.value) {
				closeReactionPanel();
			}
			if (activeProfileCard.value) {
				closeProfileCard();
			}
		}
	}

	onBeforeUnmount(() => {
		// Send final read receipt for last visible event
		const lastEventId = props.room.getLastVisibleEventId();
		if (lastEventId && settings.isFeatureEnabled(FeatureFlag.notifications)) {
			const lastEvent = props.room.findEventById(lastEventId);
			if (lastEvent) {
				pubhubs.sendPrivateReceipt(lastEvent, props.room.roomId);
			}
		}

		// Cleanup event observer
		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}

		// Cleanup keyboard listener
		document.removeEventListener('keydown', handleKeydown);
	});

	onMounted(async () => {
		await rooms.storeRoomNotice(props.room.roomId);

		// Initialize read marker from localStorage
		initializeReadMarker();

		// Setup keyboard listener for Escape
		document.addEventListener('keydown', handleKeydown);

		// Setup pagination observer
		setupPaginationObserver(topSentinel, bottomSentinel);

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
			initialLoadComplete.value = true;
			return;
		}

		// Perform initial scroll
		LOGGER.log(SMI.ROOM_TIMELINE, `performInitialScroll called with explicitEventId: ${props.eventIdToScroll}, lastReadEventId: ${displayedReadMarker.value ?? props.lastReadEventId}`);
		await performInitialScroll({
			explicitEventId: props.eventIdToScroll,
			lastReadEventId: displayedReadMarker.value ?? props.lastReadEventId,
		});

		setupEventIntersectionObserver();
		initialLoadComplete.value = true;
	});

	watch(() => roomTimeLine.value.length, onTimelineChange);

	watch(
		() => props.eventIdToScroll,
		async (eventId) => {
			if (!eventId) return;
			// Only handle changes after initial scroll is complete
			if (!isInitialScrollComplete.value) {
				return;
			}
			console.error(`[RoomTimeline] eventIdToScroll watch: calling scrollToEvent for ${eventId}`);
			scrollToEvent(eventId, { position: ScrollPosition.Center, highlight: true });
		},
	);

	watch(
		() => props.room.getCurrentEvent(),
		() => {
			refreshTimelineVersion();
			setupEventIntersectionObserver();
		},
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
		// Disconnect previous observer to prevent memory leaks
		if (eventObserver) {
			eventObserver.disconnectObserver();
		}

		eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

		// Combined handler - ElementObserver only supports ONE callback (each setUpObserver replaces the previous)
		const combinedHandler = (entries: IntersectionObserverEntry[]) => {
			// Track visibility for read marker + send receipts (single unified handler)
			handleVisibilityTracking(entries);

			// Date displayer is separate UI concern
			if (settings.isFeatureEnabled(FeatureFlag.dateSplitter)) {
				handleDateDisplayer(entries);
			}
		};

		eventObserver?.setUpObserver(combinedHandler);
	}

	/**
	 * Tracks visible messages for read marker and notifications.
	 */
	const handleVisibilityTracking = (entries: IntersectionObserverEntry[]) => {
		if (!isInitialScrollComplete.value || entries.length < 1) {
			return;
		}

		let newestVisibleEventId: string | null = null;
		let newestVisibleTimestamp = 0;

		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);

			if (!matrixEvent || matrixEvent.getType() !== EventType.RoomMessage) {
				return;
			}

			if (matrixEvent.localTimestamp > newestVisibleTimestamp) {
				newestVisibleTimestamp = matrixEvent.localTimestamp;
				newestVisibleEventId = eventId;
			}
		});

		const currentTrackedTimestamp = props.room.getLastVisibleTimeStamp();

		if (!newestVisibleEventId || newestVisibleTimestamp <= currentTrackedTimestamp) {
			return;
		}

		const capturedEventId = newestVisibleEventId;
		const capturedTimestamp = newestVisibleTimestamp;

		setTimeout(() => {
			const element = elRoomTimeline.value?.querySelector(`[id="${capturedEventId}"]`);
			if (!element || !elRoomTimeline.value) {
				return;
			}

			const containerRect = elRoomTimeline.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const isStillVisible = elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.top;

			if (!isStillVisible) {
				return;
			}

			if (capturedTimestamp > props.room.getLastVisibleTimeStamp()) {
				updateReadMarker(capturedEventId, capturedTimestamp);

				if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
					const lastVisibleEvent = props.room.findEventById(capturedEventId);
					if (lastVisibleEvent) {
						pubhubs.sendPrivateReceipt(lastVisibleEvent, props.room.roomId);
					}
				}
			}
		}, READ_DELAY_MS);
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

		// Notify scroll composable about new messages (for indicator)
		// Skip during pagination - these are old messages being loaded, not new ones
		if (newTimelineLength > oldTimelineLength && oldTimelineLength > 0 && !isLoadingPrevious.value && !isLoadingNext.value) {
			const timeline = props.room.getChronologicalTimeline();
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

		// Re-setup observer when timeline changes (ensures all handlers are attached)
		if (newestEventId?.substring(0, 1) === '~') {
			// Temporary event ID - wait for it to be replaced
			waitObservingEvent();
		} else {
			await nextTick();
			setupEventIntersectionObserver();
		}

		// If initial scroll hasn't happened yet and events just loaded, perform it now
		if (!isInitialScrollComplete.value && oldTimelineLength === 0 && newTimelineLength > 0) {
			await performInitialScroll({
				explicitEventId: props.eventIdToScroll,
				lastReadEventId: displayedReadMarker.value ?? props.lastReadEventId,
			});
			return;
		}

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended`);
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: ScrollPosition.Center, highlight: true });
	}

	function onEditPoll(poll: Poll, eventId: string) {
		editingPoll.value = { poll, eventId };
	}

	function onEditScheduler(scheduler: Scheduler, eventId: string) {
		editingScheduler.value = { scheduler, eventId };
	}

	function toggleReactionPanel(eventId: string) {
		console.error('toggleReactionPanel called with:', eventId, 'current:', activeReactionPanel.value);
		activeReactionPanel.value = activeReactionPanel.value === eventId ? null : eventId;
		console.error('activeReactionPanel now:', activeReactionPanel.value);
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
				setupEventIntersectionObserver();
				clearInterval(timer);
			}
		}, PAGINATION_COOLDOWN);
	}
</script>
