<template>
	<div v-if="room" ref="elRoomTimeline" class="h-full relative flex flex-col gap-2 overflow-y-auto scrollbar" @scroll="onScroll">
		<InlineSpinner v-if="isLoadingNewEvents" class="fixed top-16"></InlineSpinner>
		<DateDisplayer v-if="settings.isFeatureEnabled(featureFlagType.dateSplitter) && dateInformation !== 0" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()"></DateDisplayer>
		<div v-if="oldestEventIsLoaded" class="rounded-xl flex items-center justify-center w-60 mx-auto mb-12 border border-solid border-black dark:border-white">
			{{ $t('rooms.roomCreated') }}
		</div>
		<template v-for="item in roomTimeLine" :key="item.event.event_id">
			<div ref="elRoomEvent" :id="item.event.event_id">
				<RoomEvent :room="room" :event="item.event" class="room-event" @in-reply-to-click="onInReplyToClick"> </RoomEvent>
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
	import { EventTimeline } from 'matrix-js-sdk';

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

	const DELAY_POPUP_VIEW_ON_SCREEN = 4000; // 4 seconds
	const DELAY_RECEIPT_MESSAGE = 4000; // 4 seconds
	const DELAY_WAIT_OBSERVING = 100; // 100 milliseconds interval to periodically check for event Id for new message.

	let userHasScrolled = ref<boolean>(true);
	let dateInformation = ref<number>(0);
	let elementObserver: ElementObserver | null = null;
	let initialLoading: boolean = false;

	const props = defineProps({ room: { type: Room, required: true }, scrollToEventId: String });
	const emit = defineEmits(['scrolledToEventId']);

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
	watch(() => props.room.getLivetimelineLength(), onTimelineChange);

	// Watch for currently visible eventId
	watch(() => props.scrollToEventId, onScrollToEventId);

	async function setupRoomTimeline() {
		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `setupRoomTimeline...`, { roomId: props.room.roomId });

		initialLoading = true;
		await props.room.loadInitialEvents();
		initialLoading = false;

		// NB order is important here: perform scrollToEvent to last event only after storeRoomNotice has finished,
		// otherwise it will scroll to another event
		await rooms.storeRoomNotice(props.room.roomId);
		const newestEventId = props.room.getTimelineNewestMessageEventId();
		if (newestEventId) {
			scrollToEvent(newestEventId, { position: 'end' });
		}

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

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `setupRoomTimeline done`);
	}

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
		if (props.room.isNewestMessageLoaded()) return;

		LOGGER.log(SMI.ROOM_TIMELINE_TRACE, `onTimelineChange`, { newTimelineLength, oldTimelineLength });

		if (!initialLoading) {
			let newestEventId = props.room.getLiveTimelineNewestEvent()?.event_id;
			await updateTimeLineWindow(); // update timeline and (optionally) the scrollbar

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

			const prevOldestLoadedEventId = props.room.getTimelineOldestMessageEventId();
			if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
				await props.room.paginate(EventTimeline.BACKWARDS);
				await scrollToEvent(prevOldestLoadedEventId);
				// Start observing when old messages are loaded.
				settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			}
			isLoadingNewEvents.value = false;
		}

		// If scrolled to the bottom of the screen, load newer events if available
		if (Math.abs(ev.target.scrollHeight - ev.target.clientHeight - ev.target.scrollTop) <= 1) {
			isLoadingNewEvents.value = true;

			const prevNewestLoadedEventId = props.room.getTimelineNewestMessageEventId();
			if (prevNewestLoadedEventId && !newestEventLoaded.value) {
				await props.room.paginate(EventTimeline.FORWARDS);
				await scrollToEvent(prevNewestLoadedEventId, { position: 'end' });
				// Observe newer messages when timeline loads new messages.
				settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			}
			isLoadingNewEvents.value = false;
		}
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
			if (props.room.getLiveTimelineNewestEvent()?.event_id?.substring(0, 1) !== '~') {
				elementObserver?.setUpObserver(handlePrivateReceipt);
				clearInterval(timer);
			}
		}, DELAY_WAIT_OBSERVING);
	}

	// Update the timelineWindow from timelinechanges
	async function updateTimeLineWindow() {
		const currentLastEventId = props.room.getTimelineNewestMessageEventId(); // newest visible event
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
		}
	}

	//#endregion

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
