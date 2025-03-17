<template>
	<div class="flex h-full flex-col">
		<div>
			<InlineSpinner v-if="isLoadingNewEvents" class="absolute flex w-full justify-center"></InlineSpinner>
			<DateDisplayer v-if="settings.isFeatureEnabled(FeatureFlag.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()"></DateDisplayer>
			<InRoomNotifyMarker v-if="settings.isFeatureEnabled(FeatureFlag.unreadMarkers)"></InRoomNotifyMarker>
		</div>
		<div v-if="room" ref="elRoomTimeline" class="relative flex flex-1 flex-col gap-2 overflow-y-auto pb-4" @scroll="onScroll">
			<div v-if="oldestEventIsLoaded" class="mx-auto my-4 flex w-60 items-center justify-center rounded-xl border border-black dark:border-white">
				{{ $t('rooms.roomCreated') }}
			</div>
			<template v-if="roomTimeLine.length > 0">
				<div v-for="item in roomTimeLine" :key="item.event.event_id">
					<div ref="elRoomEvent" :id="item.event.event_id">
						<RoomEvent
							:room="room"
							:event="item.event"
							:event-thread-length="eventThreadLengths[item.event.event_id ?? 0]"
							class="room-event"
							@in-reply-to-click="onInReplyToClick"
							@delete-message="confirmDeleteMessage(item.event, item.isThreadRoot)"
						></RoomEvent>
						<UnreadMarker v-if="settings.isFeatureEnabled(FeatureFlag.unreadMarkers)" :currentEventId="item.event.event_id ?? ''" :currentUserId="user.user.userId"> </UnreadMarker>
					</div>
				</div>
			</template>
		</div>
		<MessageInput class="z-10" v-if="room" :room="room" :in-thread="false"></MessageInput>
	</div>
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="rooms.currentRoom" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage"></DeleteMessageDialog>
</template>

<script setup lang="ts">
	// Components
	import DateDisplayer from '../ui/DateDisplayer.vue';
	import InlineSpinner from '../ui/InlineSpinner.vue';
	import RoomEvent from './RoomEvent.vue';
	import UnreadMarker from '../ui/UnreadMarker.vue';
	import DeleteMessageDialog from '../forms/DeleteMessageDialog.vue';
	import InRoomNotifyMarker from '../ui/InRoomNotifyMarker.vue';
	import MessageInput from '../forms/MessageInput.vue';

	import { EventTimeline, EventType, Thread, MatrixEvent } from 'matrix-js-sdk';
	import { computed, onMounted, ref, reactive, watch, onUnmounted } from 'vue';
	import { ElementObserver } from '@/logic/core/elementObserver';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useRooms } from '@/logic/store/store';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import Room from '@/model/rooms/Room';
	import { RoomEmit } from '@/model/constants';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { useUser } from '@/logic/store/user';

	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const pubhubs = usePubHubs();
	const elRoomTimeline = ref<HTMLElement | null>(null);
	const elRoomEvent = ref<HTMLElement | null>(null);
	const isLoadingNewEvents = ref(false);
	const showConfirmDelMsgDialog = ref(false);
	const eventToBeDeleted = ref<TMessageEvent>();

	const DELAY_POPUP_VIEW_ON_SCREEN = 4000; // 4 seconds
	const DELAY_RECEIPT_MESSAGE = 4000; // 4 seconds
	const DELAY_WAIT_OBSERVING = 100; // 100 milliseconds interval to periodically check for event Id for new message.

	let userHasScrolled = ref<boolean>(true);
	let dateInformation = ref<number>(0);

	// indexed array of all eventid's in room with their threadlength
	let eventThreadLengths = reactive<{ [Key: string]: number }>({});

	let elementObserver: ElementObserver | null = null;
	let initialLoading: boolean = false;
	let eventToBeDeletedIsThreadRoot: boolean = false;

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		scrollToEventId: String,
	});
	const emit = defineEmits([RoomEmit.ScrolledToEventId]);

	/**
	 * Gets the current timeline and keeps track of the threadlength of each event
	 */
	const roomTimeLine = computed(() => {
		return props.room.getTimeline();
	});

	const oldestEventIsLoaded = computed(() => {
		return props.room.isOldestMessageLoaded();
	});

	const newestEventLoaded = computed(() => {
		return props.room.isNewestMessageLoaded();
	});

	onMounted(() => {
		LOGGER.log(SMI.ROOM_TIMELINE, `onMounted RoomTimeline`, { roomId: props.room.roomId });

		// timeline needs to listen to new and update ThreadEvents to update eventthreadlength
		props.room.listenToThreadNewReply(newReplyListener.bind(this));
		props.room.listenToThreadUpdate(updateReplyListener.bind(this));

		setupRoomTimeline();
	});

	onUnmounted(() => {
		props.room.stopListeningToThreadNewReply(newReplyListener.bind(this));
		props.room.stopListeningToThreadUpdate(updateReplyListener.bind(this));
	});

	watch(
		() => props.room,
		() => {
			LOGGER.log(SMI.ROOM_TIMELINE, `Room changed to room: ${props.room.roomId}`, { roomId: props.room.roomId });

			setupRoomTimeline();
		},
	);

	// Watch for new messages.
	watch(() => props.room.getLivetimelineLength(), onTimelineChange);

	// Watch for currently visible eventId
	watch(() => props.scrollToEventId, onScrollToEventId);

	function getEventThreadLengths() {
		roomTimeLine.value.forEach((event) => {
			if (event.event.event_id) {
				eventThreadLengths[event.event.event_id] = event.getThread()?.length ?? 0;
			}
		});
	}

	// When a new reply to a thread is given the timeline needs to display it per event
	//
	// parameters are not used, but needed to listen to the event, so:
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function newReplyListener(_thread: Thread, _threadEvent: MatrixEvent) {
		getEventThreadLengths();
	}

	// When an update or delete to a thread is given the timeline needs to display it per event
	//
	// parameters are not used, but needed to listen to the event, so:
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function updateReplyListener(_thread: Thread) {
		getEventThreadLengths();
	}

	async function setupRoomTimeline() {
		LOGGER.log(SMI.ROOM_TIMELINE, `setupRoomTimeline...`, { roomId: props.room.roomId });

		initialLoading = true;
		await props.room.loadInitialEvents();
		initialLoading = false;

		// NB order is important here: perform scrollToEvent to last event only after storeRoomNotice has finished,
		// otherwise it will scroll to another event
		await rooms.storeRoomNotice(props.room.roomId);
		const newestEventId = props.room.getNewestMessageEventId();
		if (newestEventId) {
			scrollToEvent(newestEventId, { position: 'end' });
		}

		if (settings.isFeatureEnabled(FeatureFlag.dateSplitter)) {
			userHasScrolled.value = true;
			setInterval(() => {
				if (userHasScrolled.value) {
					userHasScrolled.value = false;
				}
			}, DELAY_POPUP_VIEW_ON_SCREEN);
		}
		// Instantiate ElementObserver with your target element when the element is fully in the viewport.
		// Default value of 1 for threshold does not work on safari.
		elementObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });
		if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
			elementObserver?.setUpObserver(handlePrivateReceipt);
		}

		//Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(FeatureFlag.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

		// initialize thread counters on events
		getEventThreadLengths();

		LOGGER.log(SMI.ROOM_TIMELINE, `setupRoomTimeline done `, roomTimeLine);
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
		const lastSeenEventId = props.room.getLastVisibleEventId();

		setTimeout(async () => {
			const stillLastSeenEventId = props.room.getLastVisibleEventId();

			if (lastSeenEventId === stillLastSeenEventId) {
				const lastVisibleEvent = stillLastSeenEventId && props.room.findEventById(stillLastSeenEventId);
				// When sending a message it can be in your Room but not yet in the timeline since it has to go through Synapse.
				if (lastVisibleEvent && lastVisibleEvent.localTimestamp >= (props.room.findEventById(entries.at(-1)!.target.id!)?.localTimestamp ?? lastVisibleEvent.localTimestamp)) {
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
		if (!newTimelineLength || !oldTimelineLength) return;
		if (!elRoomTimeline.value) return;
		if (!rooms.currentRoom) return;
		if (props.room.isNewestMessageLoaded()) return;

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange`, { newTimelineLength, oldTimelineLength });

		if (!initialLoading) {
			let newestEventId = props.room.getLiveTimelineNewestEvent()?.event_id;
			await updateTimeLineWindow(); // update timeline and (optionally) the scrollbar

			const currentThreadId = rooms.currentRoom.getCurrentThreadId();
			if (currentThreadId) {
				// if the current thread is not in the current timeline: remove the current thread
				if (roomTimeLine.value.find((event) => event.event.event_id === currentThreadId) === undefined) {
					rooms.currentRoom.setCurrentThreadId(undefined);
				}
			}
			settings.isFeatureEnabled(FeatureFlag.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

			if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
				// If the room is empty then no reference to elRoomEvent is present. In that case, ElementObserver needs to be initialized.
				if (!elementObserver) elementObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

				// Wait until stable event Id is available, otherwise start observing.
				if (newestEventId?.substring(0, 1) === '~') {
					waitObservingEvent();
				} else {
					elementObserver?.setUpObserver(handlePrivateReceipt);
				}
			}
		}

		LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended `, roomTimeLine.value);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function onScrollToEventId(newEventId?: string, oldEventId?: string) {
		if (!newEventId) return;
		scrollToEvent(newEventId, { position: 'center', select: 'Highlight' });
	}

	//#region Events

	async function onScroll(ev: Event) {
		if (!(ev.target instanceof HTMLElement)) return;

		userHasScrolled.value = true;

		// If scrolled to the top of the screen, load older events.
		if (ev.target.scrollTop === 0) {
			isLoadingNewEvents.value = true;

			const prevOldestLoadedEventId = props.room.getTimelineOldestMessageEventId();
			if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
				await props.room.paginate(EventTimeline.BACKWARDS);
				await scrollToEvent(prevOldestLoadedEventId);
				// Start observing when old messages are loaded.
				settings.isFeatureEnabled(FeatureFlag.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			}
			isLoadingNewEvents.value = false;
		}

		// If scrolled to the bottom of the screen, load newer events if available
		if (Math.abs(ev.target.scrollHeight - ev.target.clientHeight - ev.target.scrollTop) <= 1) {
			isLoadingNewEvents.value = true;

			const prevNewestLoadedEventId = props.room.getNewestMessageEventId();
			if (prevNewestLoadedEventId && !newestEventLoaded.value) {
				await props.room.paginate(EventTimeline.FORWARDS);
				await scrollToEvent(prevNewestLoadedEventId, { position: 'end' });
				// Observe newer messages when timeline loads new messages.
				settings.isFeatureEnabled(FeatureFlag.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			}
			isLoadingNewEvents.value = false;
		}
		//Date Display Interaction callback is based on feature flag
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: 'center', select: 'Highlight' });
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
				elementObserver?.setUpObserver(handlePrivateReceipt);
				clearInterval(timer);
			}
		}, DELAY_WAIT_OBSERVING);
	}

	// Update the timelineWindow from timelinechanges
	async function updateTimeLineWindow() {
		const currentLastEventId = props.room.getNewestMessageEventId(); // newest visible event
		const inView = currentLastEventId ? elRoomTimeline.value?.querySelector(`[id="${currentLastEventId}"]`) : undefined;

		const newestEvent = props.room.getLiveTimelineNewestEvent(); // newest live event
		if (newestEvent && props.room.isVisibleEvent(newestEvent)) {
			// Make sure the new event is in the timeline when the user is the sender and/or the previous newest event was visible
			const messageSendByUser = newestEvent?.event_id && newestEvent?.sender === user.user.userId;
			if (inView || messageSendByUser) {
				props.room.paginate(EventTimeline.FORWARDS); // loads active timelinewindow to newest event
			}

			// When the new event is send by the user: scroll to the message
			if (messageSendByUser && newestEvent?.event_id) {
				await scrollToEvent(newestEvent.event_id);
			}
		} else if (newestEvent && newestEvent.type === EventType.RoomRedaction) {
			props.room.addToRedactedEventIds(newestEvent.redacts!);
		}
	}

	//#endregion

	async function scrollToEvent(eventId: string, options: { position: 'start' | 'center' | 'end'; select?: 'Highlight' | 'Select' } = { position: 'start' }) {
		LOGGER.log(SMI.ROOM_TIMELINE, `scroll to event: ${eventId}`, { eventId });

		if (!elRoomTimeline.value) throw new Error('elRoomTimeline not defined, RoomTimeline not mounted?');

		const doScroll = (elEvent: Element) => {
			elEvent.scrollIntoView({ block: options.position });

			// Style the event depending on the select option.
			if (options.select === 'Highlight') {
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
		let elEvent = elRoomTimeline.value.querySelector(`[id="${eventId}"]`);
		if (!elEvent) {
			// if the event is not in the current timeline, try to load the event
			try {
				await props.room.loadToEvent(eventId);
			} catch (e) {
				LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`);
			}
			elEvent = elRoomTimeline.value.querySelector(`[id="${eventId}"]`);
		}
		if (elEvent) {
			doScroll(elEvent);
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
