<template>
	<div v-if="room" name="room-timeline" ref="elRoomTimeline" class="h-full relative flex flex-col gap-2 overflow-y-scroll" @scroll="onScroll">
		<InlineSpinner v-if="isLoadingNewEvents" class="fixed top-16"></InlineSpinner>
		<DateDisplayer v-if="settings.isFeatureEnabled(featureFlagType.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()"></DateDisplayer>
		<div name="room-created-tag" v-if="oldestEventIsLoaded" class="rounded-xl flex items-center justify-center w-60 mx-auto mb-12 border border-solid border-black dark:border-white">{{ $t('rooms.roomCreated') }}</div>
		<template v-for="item in roomTimeLine" :key="item.event.event_id">
			<div ref="elRoomEvent" :id="item.event.event_id">
				<RoomEvent :room-type="room.getType()" :event="item.event" class="room-event" @in-reply-to-click="onInReplyToClick"></RoomEvent>
				<UnreadMarker v-if="settings.isFeatureEnabled(featureFlagType.unreadMarkers)" :currentEventId="item.event.event_id" :currentUserId="user.user.userId"></UnreadMarker>
			</div>
		</template>
	</div>
	<InRoomNotifyMarker v-if="settings.isFeatureEnabled(featureFlagType.unreadMarkers)"></InRoomNotifyMarker>
</template>

<script setup lang="ts">
	import { ElementObserver } from '@/core/elementObserver';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms, useUser } from '@/store/store';
	import { computed, onMounted, ref, watch } from 'vue';

	import { LOGGER } from '@/dev/Logger';
	import { SMI } from '@/dev/StatusMessage';
	import Room from '@/model/rooms/Room';
	import { featureFlagType, useSettings } from '@/store/store';
	import DateDisplayer from '../ui/DateDisplayer.vue';
	const settings = useSettings();

	const rooms = useRooms();
	const user = useUser();
	const pubhubs = usePubHubs();
	const elRoomTimeline = ref<HTMLElement | null>(null);
	const elRoomEvent = ref<HTMLElement | null>(null);
	const isLoadingNewEvents = ref(false);
	let newestEventId: string | undefined;

	let oldestEventIsLoaded = ref<boolean>(false);
	let userHasScrolled = ref<boolean>(true);
	let dateInformation = ref<number>(0);

	type Props = {
		room: Room;
		scrollToEventId: string;
	};
	const props = defineProps<Props>();
	const emit = defineEmits(['scrolledToEventId']);

	const roomTimeLine = computed(() => {
		return props.room.getVisibleTimeline();
	});

	const DELAY_POPUP_VIEW_ON_SCREEN = 4000; // 4 seconds

	const DELAY_RECEIPT_MESSAGE = 4000; // 4 seconds

	const DELAY_WAIT_OBSERVING = 100; // 100 milliseconds interval to periodically check for event Id for new message.

	let elementObserver: ElementObserver | null = null;

	async function setupRoomTimeline() {
		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `setupRoomTimeline...`, { roomId: props.room.roomId });

		await loadInitialEvents();

		await rooms.storeRoomNotice(props.room.roomId);

		if (settings.isFeatureEnabled(featureFlagType.dateSplitter)) {
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
		if (settings.isFeatureEnabled(featureFlagType.notifications)) {
			elementObserver?.setUpObserver(handlePrivateReceipt);
		}

		//Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

		scrollToBottom();

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `setupRoomTimeline done`);
	}

	onMounted(() => {
		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `onMounted RoomTimeline`, { roomId: props.room.roomId });

		setupRoomTimeline();
	});

	watch(
		() => props.room.roomId,
		() => {
			LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `Room changed to room: ${props.room.roomId}`, { roomId: props.room.roomId });

			setupRoomTimeline();
		},
	);

	// Watch for new messages.
	watch(() => props.room.timelineGetLength(), onTimelineChange);

	// Watch for currently visible eventId
	watch(() => props.scrollToEventId, onScrollToEventId);

	const handlePrivateReceipt = (entries: IntersectionObserverEntry[]) => {
		if (entries.length < 1) return;
		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);
			if (matrixEvent && matrixEvent.getType() === 'm.room.message') {
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
				lastVisibleEvent && lastVisibleEvent.localTimestamp >= props.room.findEventById(entries.at(-1)!.target.id!)?.localTimestamp && (await pubhubs.sendPrivateReceipt(lastVisibleEvent));
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
			if (matrixEvent && matrixEvent.getType() === 'm.room.message') {
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
		if (!newEventsExist()) return;

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `onTimelineChange`, { newTimelineLength, oldTimelineLength });

		newestEventId = props.room.timelineGetNewestEvent()?.event_id;

		await showMessageFromSender();

		settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

		if (settings.isFeatureEnabled(featureFlagType.notifications)) {
			// If the room is empty then no reference to elRoomEvent is present. In that case, ElementObserver needs to be initialized.
			if (!elementObserver) elementObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

			// Wait until stable event Id is available, otherwise start observing.
			if (newestEventId?.substring(0, 1) === '~') {
				waitObservingEvent();
			} else {
				elementObserver?.setUpObserver(handlePrivateReceipt);
			}
		}

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `onTimelineChange ended`);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function onScrollToEventId(newEventId?: string, oldEventId?: string) {
		if (!newEventId) return;
		scrollToEvent(newEventId, { position: 'center', select: 'Highlight' });
		emit('scrolledToEventId');
	}

	//#region Events

	async function onScroll(ev: Event) {
		if (!(ev.target instanceof HTMLElement)) return;

		userHasScrolled.value = true;
		// If scrolled to the top of the screen, load older events.
		if (ev.target.scrollTop === 0) {
			isLoadingNewEvents.value = true;
			const prevOldestLoadedEventId = props.room.timelineGetOldestMessageEventId();
			oldestEventIsLoaded.value = !(await props.room.loadOlderEvents());
			if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
				await scrollToEvent(prevOldestLoadedEventId); //Wait for scrolling to end.
				// Start observing when old messages are loaded.
				settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			}
			isLoadingNewEvents.value = false;
		}

		// If scrolled to the bottom of the screen, load newer events
		// if (Math.abs(ev.target.scrollHeight - ev.target.clientHeight - ev.target.scrollTop) <= 0.1) {
		// 	// load newer events into timeline
		// 	isLoadingNewEvents.value = true;
		// 	const prevNewestLoadedEventId = props.room.timelineGetNewestMessageEventId();
		// 	const newestEventIsLoaded = await props.room.loadNewerEvents();
		// 	if (prevNewestLoadedEventId && !newestEventIsLoaded) {
		// 		await scrollToEvent(prevNewestLoadedEventId);
		// 		settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
		// 	}
		// 	isLoadingNewEvents.value = false;
		// }
		//Date Display Interaction callback is based on feature flag
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: 'center', select: 'Highlight' });
	}

	/**
	 *  Wait for observation if stable event Id is not assigned.
	 */
	function waitObservingEvent() {
		let timer = setInterval(function () {
			if (props.room.timelineGetNewestEvent()?.event_id?.substring(0, 1) !== '~') {
				elementObserver?.setUpObserver(handlePrivateReceipt);
				clearInterval(timer);
			}
		}, DELAY_WAIT_OBSERVING);
	}

	/**
	 * When a user posts a message we want to scroll down to that message.
	 */
	async function showMessageFromSender() {
		const lastEvent = props.room.getVisibleTimeline().at(-1);
		let lastEventId = lastEvent?.event.event_id;
		if (lastEvent?.event.sender === user.user.userId && lastEventId) await scrollToEvent(lastEventId);
	}

	//#endregion

	// Removed this for now as lastReadEventId might be an invisible event (to which you cannot scroll). This might have been causing issues.
	// async function scrollToLastReadEvent() {
	// 	const wrappedReceipt = props.room.getReadReceiptForUserId(user.user.userId, false, ReceiptType.ReadPrivate);
	// 	if (!wrappedReceipt) return;
	// 	const lastReadEventId = wrappedReceipt?.eventId;
	// 	if (lastReadEventId) await scrollToEvent(lastReadEventId);
	// }

	async function scrollToEvent(eventId: string, options: { position: 'start' | 'center' | 'end'; select?: 'Highlight' | 'Select' } = { position: 'start' }) {
		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `scroll to event: ${eventId}`, { eventId });

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

		// If the event is already rendered, we can scroll to it immediately (this is quicker).
		let elEvent = elRoomTimeline.value.querySelector(`[id="${eventId}"]`);
		if (elEvent) {
			doScroll(elEvent);
		} else {
			await props.room.loadToEvent(eventId);

			elEvent = elRoomTimeline.value.querySelector(`[id="${eventId}"]`);
			if (!elEvent) throw new Error(`Cannot scroll to event that is not rendered (eventId: ${eventId}).`);

			doScroll(elEvent);
		}
	}

	function scrollToBottom() {
		elRoomTimeline.value?.scrollTo(0, elRoomTimeline.value.scrollHeight);
	}

	/**
	 * Sometimes, not enough messages are loaded by matrix-js-sdk because of other types of events (for example, a room rename event) being loaded.
	 * This function loads around 15 messages if there are that many.
	 *
	 */
	async function loadInitialEvents() {
		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `loadInitialEvents...`, { roomId: props.room.roomId, roomTimeLine: roomTimeLine.value.map((e) => e.event) });

		let numLoadedMessages = props.room.timelineGetNumMessageEvents();
		let allMessagesLoaded = false;

		while (numLoadedMessages < 15 && !allMessagesLoaded) {
			allMessagesLoaded = !(await props.room.loadOlderEvents());
			numLoadedMessages = props.room.timelineGetNumMessageEvents();
		}

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `loadInitialEvents done`, { numLoadedMessages, roomTimeLine: roomTimeLine.value.map((e) => e.event) });
	}

	function newEventsExist(): boolean {
		return newestEventId !== props.room.timelineGetNewestEvent()?.event_id;
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
