<template>
	<div class="flex h-full flex-col">
		<div>
			<InlineSpinner v-if="isLoadingNewEvents" class="absolute flex w-full justify-center" />
			<DateDisplayer v-if="settings.isFeatureEnabled(FeatureFlag.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()" />
			<InRoomNotifyMarker v-if="settings.isFeatureEnabled(FeatureFlag.unreadMarkers)" />
		</div>
		<div v-if="room" ref="elRoomTimeline" class="relative flex flex-1 flex-col gap-2 overflow-x-hidden overflow-y-scroll" @scroll="onScroll">
			<div ref="topSentinel" class="pointer-events-none min-h-[1px]" style="content-visibility: hidden"></div>
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
							class="room-event"
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
									<Reaction v-if="reactionExistsForMessage(item.matrixEvent.event.event_id, item.matrixEvent)" :reactEvent="onlyReactionEvent" :messageEventId="item.matrixEvent.event.event_id"></Reaction>
								</div>
							</template>
						</RoomMessageBubble>
						<UnreadMarker v-if="settings.isFeatureEnabled(FeatureFlag.unreadMarkers)" :currentEventId="item.matrixEvent.event.event_id ?? ''" :currentUserId="user.userId" />
					</div>
				</div>
			</template>
			<div ref="bottomSentinel" class="pointer-events-none min-h-[1px]" style="content-visibility: hidden"></div>
		</div>
		<MessageInput class="z-10" v-if="room" :room="room" :in-thread="false" :editing-poll="editingPoll" :editing-scheduler="editingScheduler"></MessageInput>
	</div>
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="rooms.currentRoom" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage" />
	<InRoomNotifyMarker v-if="settings.isFeatureEnabled(FeatureFlag.unreadMarkers)" />
</template>

<script setup lang="ts">
	// Packages
	import { Direction, EventType, MatrixEvent } from 'matrix-js-sdk';
	import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

	// Components
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import DateDisplayer from '@hub-client/components/ui/DateDisplayer.vue';
	import InRoomNotifyMarker from '@hub-client/components/ui/InRoomNotifyMarker.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';
	import UnreadMarker from '@hub-client/components/ui/UnreadMarker.vue';

	// Logic
	import { ElementObserver } from '@hub-client/logic/core/elementObserver';
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { RelationType, RoomEmit, ScrollBehavior, ScrollPosition, ScrollSelect, SystemDefaults } from '@hub-client/models/constants';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { TCurrentEvent } from '@hub-client/models/events/types';
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
	const isLoadingNewEvents = ref(false);
	const showConfirmDelMsgDialog = ref(false);
	const activeProfileCard = ref<string | null>(null);
	const activeReactionPanel = ref<string | null>(null);
	const eventToBeDeleted = ref<TMessageEvent>();
	const editingPoll = ref<{ poll: Poll; eventId: string } | undefined>(undefined);
	const editingScheduler = ref<{ scheduler: Scheduler; eventId: string } | undefined>(undefined);

	const DELAY_POPUP_VIEW_ON_SCREEN = 4000; // 4 seconds
	const DELAY_RECEIPT_MESSAGE = 4000; // 4 seconds
	const DELAY_WAIT_OBSERVING = 100; // 100 milliseconds interval to periodically check for event Id for new message.

	let userHasScrolled = ref<boolean>(true);
	let dateInformation = ref<number>(0);

	let eventToBeDeletedIsThreadRoot: boolean = false;

	// Observer Variables.
	// TODO: make both observers use ElementObserver class.
	let eventObserver: ElementObserver | null = null;
	let timelineObserver: IntersectionObserver | null = null;

	let suppressNextObservertrigger: boolean = false;

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
	});
	const emit = defineEmits([RoomEmit.ScrolledToEventId]);

	/**
	 * Gets the current timeline and keeps track of the threadlength of each event
	 */
	const roomTimeLine = computed(() => {
		return props.room.getTimeline();
	});

	const onlyReactionEvent = computed(() => {
		// To stop from having duplicate events
		props.room.getRelatedEvents().forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent));
		return props.room.getCurrentEventRelatedEvents();
	});

	const oldestEventIsLoaded = computed(() => {
		return props.room.isOldestMessageLoaded();
	});

	const newestEventIsLoaded = computed(() => {
		return props.room.isNewestMessageLoaded();
	});

	defineExpose({ elRoomTimeline }); // Expose timeline to parent to save and restore scrollposition when leaving room

	onBeforeUnmount(() => {
		if (timelineObserver) {
			timelineObserver.disconnect();
			timelineObserver = null;
		}
		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}
	});

	onMounted(() => {
		LOGGER.log(SMI.ROOM_TIMELINE, `onMounted RoomTimeline`, { roomId: props.room.roomId });
		setupRoomTimeline();
		setupTimeLineIntersectionObserver();
	});

	watch(() => roomTimeLine.value.length, onTimelineChange);

	watch(
		() => props.room.getCurrentEvent(),
		async () => {
			// This needs to await otherwise events are not loaded when switching rooms
			await onScrollToEvent(props.room.getCurrentEvent());
			setupEventIntersectionObserver();
		},
		{ deep: true },
	);
	/*
	If the scrollbar is not visible and the last message is not loaded do a paginate.
	*/
	async function checkAndPaginateIfNeeded() {
		let container = elRoomTimeline.value;
		if (!container) return;
		if (container.scrollHeight <= container.clientHeight && !oldestEventIsLoaded.value) {
			await loadPrevious();
		}
	}

	// Is there a reaction for RoomMessageEvent ID.
	// If there is then show the reaction otherwise dont render reaction UI component.
	function reactionExistsForMessage(messageEventId: string | undefined, matrixEvent: MatrixEvent): boolean {
		if (matrixEvent.isRedacted()) return false;
		if (!messageEventId) return false;

		const reactionEvent = onlyReactionEvent.value.find((event) => {
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

	async function setupRoomTimeline() {
		LOGGER.log(SMI.ROOM_TIMELINE, `setupRoomTimeline...`, {
			roomId: props.room.roomId,
		});

		props.room.initTimeline();

		await rooms.storeRoomNotice(props.room.roomId);

		// set up any action on scrolling e.g., date popup
		onScroll();

		LOGGER.log(SMI.ROOM_TIMELINE, `setupRoomTimeline done `, roomTimeLine);
		props.room.setCurrentEvent(props.room.getLiveTimelineNewestEvent as unknown as TCurrentEvent);
	}

	function setupEventIntersectionObserver() {
		eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

		if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
			eventObserver?.setUpObserver(handlePrivateReceipt);
		}
		//Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);
	}

	function setupTimeLineIntersectionObserver() {
		const options = {
			root: elRoomTimeline.value,
			threshold: 0.001, // Trigger when 0.1% of the sentinel is visible,
		};

		timelineObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!suppressNextObservertrigger && entry.isIntersecting) {
					if (entry.target === topSentinel.value) {
						loadPrevious();
					} else if (entry.target === bottomSentinel.value) {
						loadNext();
					}
				}
			});
		}, options);

		if (topSentinel.value && bottomSentinel.value) {
			timelineObserver.observe(topSentinel.value);
			timelineObserver.observe(bottomSentinel.value);
		}
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
					//  IF event from timelinemanager  doesn't have room Id - private receipt will not be send.
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

	// TODO Sliding sync adapt this
	async function onTimelineChange(newTimelineLength?: number, oldTimelineLength?: number) {
		if (typeof newTimelineLength !== 'number' || newTimelineLength < 0 || typeof oldTimelineLength !== 'number' || oldTimelineLength < 0) return;

		if (!elRoomTimeline.value) return;
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
			if (!eventObserver || !elRoomEvent) {
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
				scrollToEvent({ eventId: newestEventId }, { position: ScrollPosition.End });
			}
		}

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended `, roomTimeLine.value);
		// TODO removed: this caused a loop that scrolled loaded al messages and made far too many calls
		//checkAndPaginateIfNeeded();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function onScrollToEvent(currentEvent: TCurrentEvent | undefined) {
		if (currentEvent) {
			scrollToEvent(currentEvent, { position: ScrollPosition.Center, select: ScrollSelect.Highlight });
		}
	}

	function onScroll() {
		userHasScrolled.value = true;
		setInterval(() => {
			if (userHasScrolled.value) {
				userHasScrolled.value = false;
			}
		}, DELAY_POPUP_VIEW_ON_SCREEN);
	}

	//#region Events

	async function loadPrevious() {
		isLoadingNewEvents.value = true;

		// Check if elRoomTimeline.value is defined
		const container = elRoomTimeline.value;
		if (!container) return;

		// Store scroll information before loading older messages
		const prevScrollHeight = container.scrollHeight;
		const prevScrollTop = container.scrollTop;

		const prevOldestLoadedEventId = props.room.getTimelineOldestMessageId();
		if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
			suppressNextObservertrigger = true;

			await props.room.paginate(Direction.Backward, SystemDefaults.RoomTimelineLimit, prevOldestLoadedEventId);

			// Wait for DOM update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));

			// Compute the height difference caused by the newly added messages
			const newScrollHeight = container.scrollHeight;
			const heightDiff = newScrollHeight - prevScrollHeight;

			// Restore the previous scroll position
			container.scrollTop = prevScrollTop + heightDiff;

			setTimeout(() => {
				suppressNextObservertrigger = false;
			}, 10);

			settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);
		}

		isLoadingNewEvents.value = false;
	}

	async function loadNext() {
		isLoadingNewEvents.value = true;

		const prevNewestLoadedEventId = props.room.getTimelineNewestMessageEventId();
		if (prevNewestLoadedEventId && !newestEventIsLoaded.value) {
			suppressNextObservertrigger = true;

			await props.room.paginate(Direction.Forward, SystemDefaults.RoomTimelineLimit, prevNewestLoadedEventId);

			await scrollToEvent({ eventId: prevNewestLoadedEventId }, { position: ScrollPosition.End });

			// Wait for DOM to update and layout to settle
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve)); // Wait for layout

			setTimeout(() => {
				suppressNextObservertrigger = false;
			}, 10); // adjust delay if needed

			settings.isFeatureEnabled(FeatureFlag.dateSplitter) && eventObserver?.setUpObserver(handleDateDisplayer);
		}
		isLoadingNewEvents.value = false;
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent({ eventId: inReplyToId }, { position: ScrollPosition.Center, select: ScrollSelect.Highlight });
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

	async function scrollToEvent(
		currentEvent: TCurrentEvent,
		options: {
			position: ScrollPosition.Start | ScrollPosition.Center | ScrollPosition.End;
			select?: ScrollSelect.Highlight | ScrollSelect.Select;
		} = { position: ScrollPosition.Start },
	) {
		LOGGER.log(SMI.ROOM_TIMELINE, `scroll to event: ${currentEvent.eventId}`, { eventId: currentEvent.eventId });

		if (!elRoomTimeline.value) throw new Error('elRoomTimeline not defined, RoomTimeline not mounted?');

		const doScroll = (elEvent: Element, currentEvent: TCurrentEvent) => {
			// Position is taken from currentEvent, otherwise options
			const position = currentEvent.position ?? options.position;
			elEvent.scrollIntoView({ block: position, behavior: ScrollBehavior.Smooth });
			// Style the event depending on the select option.
			if (options.select === ScrollSelect.Highlight) {
				elEvent.classList.add('highlighted');
				window.setTimeout(() => {
					elEvent.classList.add('unhighlighted');
					window.setTimeout(() => {
						elEvent.classList.remove('highlighted');
					}, 500);
				}, 2000);
			}
		};

		// try to find the event in the current timeline
		let elEvent = elRoomTimeline.value.querySelector(`[id="${currentEvent.eventId}"]`);
		if (!elEvent) {
			// if the event is not in the current timeline, try to load the event
			try {
				await props.room.loadToEvent(currentEvent);
			} catch (e) {
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${currentEvent.eventId}`);
			}
			elEvent = elRoomTimeline.value.querySelector(`[id="${currentEvent.eventId}"]`);
		}
		if (elEvent) {
			doScroll(elEvent, currentEvent);
			emit(RoomEmit.ScrolledToEventId);
		}
	}
</script>

<style scoped>
	/* The highlight animation is used when scrolling to an event with the highlight option selected. */
	.room-event {
		background: none;
		border-radius: 15px;
	}

	.room-event.highlighted {
		animation: highlight 1s;
	}

	@keyframes highlight {
		0% {
			background: none;
		}

		70% {
			background: gray;
		}

		100% {
			background: none;
		}
	}
</style>
