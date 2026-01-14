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
		<div v-if="room" ref="elRoomTimeline" class="relative flex flex-1 flex-col space-y-2 overflow-x-hidden overflow-y-scroll pb-2" @scroll="onScroll">
			<div ref="topSentinel" class="pointer-events-none !mt-0 h-[1px]" style="content-visibility: hidden"></div>
			<div v-if="oldestEventIsLoaded" class="border-on-surface-variant text-on-surface-variant text-label-small mx-auto my-4 flex w-60 items-center justify-center rounded-xl border px-4">
				{{ $t('rooms.roomCreated') }}
			</div>
			<template v-if="roomTimeLine.length > 0">
				<div v-for="item in roomTimeLine" :key="item.matrixEvent.event.event_id">
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
						<LastReadMarker :currentEventId="item.matrixEvent.event.event_id ?? ''" :room="props.room" />
					</div>
				</div>
			</template>
			<div ref="bottomSentinel" class="pointer-events-none mt-0! h-[1px]" style="content-visibility: hidden"></div>
		</div>

		<!-- Loading indicator at bottom when loading newer messages -->
		<div v-if="isLoadingNext" class="bg-surface flex w-full items-center justify-center py-3">
			<InlineSpinner class="mr-2" />
			<span class="text-on-surface-variant text-label-small">
				{{ $t('rooms.loading_newer_messages') }}
			</span>
		</div>

		<NewMessagesButton v-if="showIndicator" :count="newMessageCount" @click="scrollToNewestMessages" />
		<MessageInput class="z-10" v-if="room" :room="room" :in-thread="false" :editing-poll="editingPoll" :editing-scheduler="editingScheduler"></MessageInput>
	</div>
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="rooms.currentRoom" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage" />
</template>

<script setup lang="ts">
	// Packages
	import { EventType } from 'matrix-js-sdk';
	import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Components
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import DateDisplayer from '@hub-client/components/ui/DateDisplayer.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import LastReadMarker from '@hub-client/components/ui/LastReadMarker.vue';
	import NewMessagesButton from '@hub-client/components/ui/NewMessagesButton.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Composables
	import { useInitialScroll } from '@hub-client/composables/useInitialScroll';
	import { useTimelineObservers } from '@hub-client/composables/useTimelineObservers';
	import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';
	import { useTimelineScroll } from '@hub-client/composables/useTimelineScroll';

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

	const DELAY_RECEIPT_MESSAGE = 4000; // 4 seconds
	const DELAY_WAIT_OBSERVING = 100; // 100 milliseconds interval to periodically check for event Id for new message

	let dateInformation = ref<number>(0);
	let eventToBeDeletedIsThreadRoot: boolean = false;

	// Observer for dates
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
	const { scrollToEvent, isScrolling, showIndicator, newMessageCount, resetCount } = useTimelineScroll(elRoomTimeline, props.room, user.userId || '');
	const { loadPrevious, loadNext, isLoadingPrevious, isLoadingNext, oldestEventIsLoaded, newestEventIsLoaded } = useTimelinePagination(elRoomTimeline, props.room, scrollToEvent);
	const { setupPaginationObserver, setupRelatedEventsObserver, updateRelatedEventsObserver } = useTimelineObservers(elRoomTimeline);
	const { performInitialScroll } = useInitialScroll(props.room.roomId, props.room, scrollToEvent);

	// Use isScrolling for date popup
	const userHasScrolled = computed(() => !isScrolling.value);

	/**
	 * Gets the current timeline and keeps track of the threadlength of each event
	 */
	const roomTimeLine = computed(() => {
		return props.room.getTimeline();
	});

	defineExpose({ elRoomTimeline }); // Expose timeline to parent to save and restore scrollposition when leaving room

	onBeforeUnmount(() => {
		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}
	});

	onMounted(async () => {
		console.warn('[Timeline-Component] onMounted: started', { roomId: props.room.roomId, eventIdToScroll: props.eventIdToScroll, lastReadEventId: props.lastReadEventId });
		LOGGER.log(SMI.ROOM_TIMELINE, `onMounted RoomTimeline`, { roomId: props.room.roomId });

		// Store room notice
		await rooms.storeRoomNotice(props.room.roomId);
		console.warn('[Timeline-Component] storeRoomNotice: completed');

		// Setup observers
		setupPaginationObserver(topSentinel, bottomSentinel, {
			onLoadPrevious: loadPrevious,
			onLoadNext: loadNext,
		});
		console.warn('[Timeline-Component] setupPaginationObserver: completed');

		setupRelatedEventsObserver((eventIds) => {
			props.room.fetchRelatedEvents(eventIds);
		});
		console.warn('[Timeline-Component] setupRelatedEventsObserver: completed');

		// Wait for timeline to be fully rendered in the DOM
		await nextTick();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		console.warn('[Timeline-Component] DOM render: completed');

		// Wait for timeline events to be loaded
		let attempts = 0;
		while (roomTimeLine.value.length === 0 && attempts < 20) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			attempts++;
		}
		console.warn('[Timeline-Component] Timeline events loaded:', { length: roomTimeLine.value.length, attempts });

		if (roomTimeLine.value.length === 0) {
			console.warn('[Timeline-Component] Timeline still empty after waiting');
			LOGGER.warn(SMI.ROOM_TIMELINE, 'Timeline still empty after waiting');
			return;
		}

		// Perform initial scroll using new composables
		// performInitialScroll automatically determines target with optional overrides
		console.warn('[Timeline-Component] Calling performInitialScroll with:', {
			explicitEventId: props.eventIdToScroll,
			lastReadEventId: props.lastReadEventId,
		});
		await performInitialScroll({
			explicitEventId: props.eventIdToScroll,
			lastReadEventId: props.lastReadEventId,
		});
		console.warn('[Timeline-Component] performInitialScroll: completed');

		// Setup element observer for dates
		setupEventIntersectionObserver();
		console.warn('[Timeline-Component] onMounted: fully completed');
	});

	watch(() => roomTimeLine.value.length, onTimelineChange);

	watch(
		() => props.eventIdToScroll,
		(eventId) => {
			if (!eventId) return;
			scrollToEvent(eventId, { position: ScrollPosition.Center });
		},
	);

	watch(
		() => props.room.getCurrentEvent(),
		() => setupEventIntersectionObserver(),
		{ deep: true },
	);

	function onlyReactionEvent(eventId: string) {
		// To stop from having duplicate events
		props.room.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation }).forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent.matrixEvent));
		return props.room.getCurrentEventRelatedEvents();
	}

	// Is there a reaction for RoomMessageEvent ID.
	// If there is then show the reaction otherwise dont render reaction UI component.
	function reactionExistsForMessage(timelineEvent: TimelineEvent): boolean {
		if (timelineEvent.isDeleted || (timelineEvent.matrixEvent && timelineEvent.matrixEvent.isRedacted())) return false;
		const messageEventId = timelineEvent.matrixEvent.event.event_id;
		if (!messageEventId) return false;

		const reactionEvent = onlyReactionEvent(messageEventId).find((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			// Check if this reaction relates to the target message
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
		// Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);
	}

	const handlePrivateReceipt = (entries: IntersectionObserverEntry[]) => {
		if (entries.length < 1) return;
		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);
			if (matrixEvent && matrixEvent.getType() === EventType.RoomMessage) {
				// Only send the receipt to the last visible event on screen
				if (props.room.getLastVisibleTimeStamp() < matrixEvent.localTimestamp) {
					props.room.setLastVisibleEventId(eventId);
					props.room.setLastVisibleTimeStamp(matrixEvent.localTimestamp);
				}
			}
		});

		const lastSeenEventId = props.room.getRoomNewestMessageId();

		setTimeout(async () => {
			const stillLastSeenEventId = props.room.getRoomNewestMessageId();
			if (lastSeenEventId === stillLastSeenEventId) {
				let lastVisibleEvent = props.room.findEventById(stillLastSeenEventId!);

				if (lastVisibleEvent?.event.event_id === props.room.getLiveTimelineEvents().at(-1)?.event.event_id) {
					lastVisibleEvent = props.room.getLiveTimelineEvents().at(-1);
				}
				// When sending a message it can be in your Room but not yet in the timeline since it has to go through Synapse.
				if (lastVisibleEvent && lastVisibleEvent.localTimestamp >= (props.room.findEventById(entries.at(-1)!.target.id!)?.localTimestamp ?? lastVisibleEvent.localTimestamp)) {
					// IF event from timelinemanager  doesn't have room Id - private receipt will not be send.
					// We look at synapse client for the last Event.
					if (!lastVisibleEvent.getRoomId()) {
						lastVisibleEvent = props.room.matrixRoom.getLastLiveEvent();
					}

					await pubhubs.sendPrivateReceipt(lastVisibleEvent);
				}
			}
		}, DELAY_RECEIPT_MESSAGE);
	};

	// Callback for handling visibility of message for finding the date that would be pop up while scrolling.
	const handleDateDisplayer = (entries: IntersectionObserverEntry[]) => {
		// Only identify the first visible message on screen.
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

		await rooms.waitForInitialRoomsLoaded(); // Need to await loading of rooms, otherwise there is no currentRoom

		if (!rooms.currentRoom) return;
		if (!newestEventIsLoaded.value) return;

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange`, {
			newTimelineLength,
			oldTimelineLength,
		});

		const lastEventMsgType = props.room.getLiveTimelineEvents().at(-1)?.getContent().msgtype;
		if (typeof lastEventMsgType === 'string') {
			if (lastEventMsgType in PubHubsInvisibleMsgType) {
				return;
			}
		}

		let newestEventId = props.room.getRoomNewestMessageId();

		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);

		if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
			// If the room is empty then no reference to elRoomEvent is present. In that case, ElementObserver needs to be initialized.
			if (!eventObserver || !elRoomEvent.value) {
				eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });
			}

			// Wait until stable event Id is available, otherwise start observing.
			if (newestEventId?.substring(0, 1) === '~') {
				waitObservingEvent();
			} else {
				nextTick();
				eventObserver = new ElementObserver(elRoomEvent.value!, { threshold: 0.95 });
				eventObserver?.setUpObserver(handlePrivateReceipt);
			}
		}
		if (newestEventId) {
			const newestEvent = props.room.getLiveTimelineNewestEvent();
			if (newestEvent && newestEvent.sender === user.userId) {
				scrollToEvent(newestEventId, { position: ScrollPosition.End });
			}
		}

		// Update related events observer with current timeline events
		const eventIds = roomTimeLine.value.map((x) => x.matrixEvent.event.event_id || '').filter(Boolean);
		updateRelatedEventsObserver(eventIds);

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended `, roomTimeLine.value);
	}

	// #region Events

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: ScrollPosition.Center, highlight: true });
	}

	async function scrollToNewestMessages() {
		const newestEventId = props.room.getTimelineNewestMessageEventId();
		if (newestEventId) {
			await scrollToEvent(newestEventId, { position: ScrollPosition.End });
		}
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

	/**
	 *  Wait for observation if stable event Id is not assigned.
	 */
	function waitObservingEvent() {
		let timer = setInterval(function () {
			if (props.room.getLiveTimelineNewestEvent()?.event_id?.substring(0, 1) !== '~') {
				eventObserver?.setUpObserver(handlePrivateReceipt);
				clearInterval(timer);
			}
		}, DELAY_WAIT_OBSERVING);
	}

	//#endregion
</script>
