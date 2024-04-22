<template>
	<div v-if="room" id="room-timeline" ref="elRoomTimeline" class="h-full overflow-y-auto relative" @scroll="onScroll">
		<InlineSpinner v-if="isLoadingNewEvents" class="fixed top-16"></InlineSpinner>
		<div class="fixed right-60 top-24">
			<DateDisplayer v-if="settings.isFeatureEnabled(featureFlagType.dateSplitter)" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()"></DateDisplayer>
		</div>
		<div id="room-created-tag" v-if="oldestEventIsLoaded" class="rounded-xl flex items-center justify-center w-60 mx-auto mb-12 border border-solid border-black dark:border-white">{{ $t('rooms.roomCreated') }}</div>
		<template v-for="(item, index) in myTimeLine" :key="index">
			<div ref="elRoomEvent" :id="item.event.event_id">
				<RoomEvent :event="item.event" class="room-event" @on-in-reply-to-click="onInReplyToClick"></RoomEvent>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, watch, computed } from 'vue';
	import { useRooms, useUser } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { ElementObserver } from '@/core/elementObserver';
	import { MatrixEvent } from 'matrix-js-sdk';
	import Room from '@/model/rooms/Room';
	import DateDisplayer from '../ui/DateDisplayer.vue';
	import { useSettings, featureFlagType } from '@/store/store';

	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const pubhubs = usePubHubs();

	const elRoomTimeline = ref<HTMLElement | null>(null);
	const elRoomEvent = ref<HTMLElement | null>(null);
	const isLoadingNewEvents = ref(false);

	let newestEventId: string | undefined;
	let oldestEventIsLoaded: Ref<boolean> = ref(false);
	let timeStampEvent: TimeLineEventTimeStamp[] = [];
	let userHasScrolled: Ref<boolean> = ref(true);
	let dateInformation = ref<Number>(0);

	type TimeLineEventTimeStamp = {
		eventId: string;
		timeStamp: number;
	};

	type Props = {
		room: Room;
	};

	const props = defineProps<Props>();

	const myTimeLine = computed(() => {
		return props.room.getVisibleTimeline();
	});

	const DELAY_VALID_M_EVENT_ID = 1000; // 1 second
	const DELAY_POPUP_VIEW_ON_SCREEN = 4000; // 4 seconds
	let elementObserver: ElementObserver | null = null;

	async function setupRoom() {
		await loadInitialEvents();
		scrollToBottom();

		await rooms.storeRoomNotice(props.room.roomId);
	}

	onMounted(async () => {
		scrollStatus();
		setInterval(() => {
			if (userHasScrolled.value) {
				userHasScrolled.value = false;
			}
		}, DELAY_POPUP_VIEW_ON_SCREEN);

		// Instantiate ElementObserver with your target element when the element is fully in the viewport.
		elementObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 1.0 });

		//Observer for read receipts
		settings.isFeatureEnabled(featureFlagType.readReceipt) && elementObserver?.setUpObserver(handleReadReceiptIntersection);

		//Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

		await setupRoom(); //First time set-up
	});

	watch(
		() => props.room.roomId, //This is a getter, so we only watch on roomId changes.
		async () => {
			await setupRoom();
		},
	);

	// Watch for new messages.
	watch(
		() => elRoomEvent.value && elRoomEvent.value.length,
		() => {
			settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
			settings.isFeatureEnabled(featureFlagType.readReceipt) && elementObserver?.setUpObserver(handleReadReceiptIntersection);
		},
	);
	watch(() => props.room.timelineGetLength(), onTimelineChange);

	// Callback for handling visibility of message for acknowledging read receipts.
	const handleReadReceiptIntersection = (entries: IntersectionObserverEntry[]) => {
		entries.forEach(async (entry) => {
			const eventId = entry.target.id;
			const matrixEvent: MatrixEvent = props.room.findEventById(eventId);

			// Added a delay of one second to cater matrix to sync actual event ID
			// Before sync, it generates dummy event ID consisting of txn and room Id.
			// TODO: periodically checks if valid event Id is generated.
			setTimeout(async () => {
				// For each visible message, send a read receipt.
				if (matrixEvent && matrixEvent.getType() === 'm.room.message') {
					await pubhubs.sendReadReceipt(matrixEvent);
				}
			}, DELAY_VALID_M_EVENT_ID);
		});
	};

	// Callback for handling visibility of message for finding the date that would be pop up while scrolling.
	const handleDateDisplayer = (entries: IntersectionObserverEntry[]) => {
		timeStampEvent = [];
		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = props.room.findEventById(eventId);
			if (matrixEvent && matrixEvent.getType() === 'm.room.message') {
				timeStampEvent.push({ eventId: eventId, timeStamp: matrixEvent.localTimestamp });
			}
		});
		const minTimeStamp = minTimeStampForTimeLineEvent();
		const firstReadEvent = props.room.findEventById(minTimeStamp.eventId);
		if (!firstReadEvent) return;
		dateInformation.value = firstReadEvent?.localTimestamp;
	};

	function minTimeStampForTimeLineEvent(): TimeLineEventTimeStamp {
		// Initialize object with initial values
		if (timeStampEvent.length < 1) return { eventId: '', timeStamp: -1 };

		// Find the object with minimum timestamp
		return timeStampEvent.reduce((accumulator, currentValue) => {
			return accumulator.timeStamp < currentValue.timeStamp ? accumulator : currentValue;
		});
	}

	async function onTimelineChange(newTimelineLength?: number, oldTimelineLength?: number) {
		elementObserver?.setUpObserver(handleReadReceiptIntersection);

		if (!newTimelineLength || !oldTimelineLength) return;
		if (!elRoomTimeline.value) return;
		// We only want to watch timelinechanges for new events not older events.
		if (!newEventsExist()) return;

		if (!isScrolling() || props.room.timelineContainsUserSentEvents(user.user.userId, oldTimelineLength)) {
			setTimeout(scrollToBottom, 100);
		}

		newestEventId = props.room.timelineGetNewestEvent()?.event_id;
	}

	//#region Events

	async function onScroll(ev: Event) {
		if (!(ev.target instanceof HTMLElement)) return;

		// If scrolled to the top of the screen, load older events.
		if (ev.target.scrollTop === 0) {
			isLoadingNewEvents.value = true;
			const prevOldestLoadedEventId = props.room.timelineGetOldestMessageEventId();
			oldestEventIsLoaded.value = await pubhubs.loadOlderEvents(props.room);
			if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
				scrollToEvent(prevOldestLoadedEventId);
			}
			isLoadingNewEvents.value = false;
		}
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: 'TopCenter', select: 'Highlight' });
	}

	//#endregion
	function scrollToBottom() {
		elRoomTimeline.value?.scrollTo(0, elRoomTimeline.value.scrollHeight);
	}

	// To detect if scrolling has started.
	function scrollStatus() {
		if (!elRoomTimeline.value) return;
		elRoomTimeline.value.onscroll = () => (userHasScrolled.value = true);
	}

	async function scrollToEvent(eventId: string, options: { position: 'Top' | 'TopCenter'; select?: 'Highlight' | 'Select' } = { position: 'Top' }) {
		if (!elRoomTimeline.value) return;

		await pubhubs.loadToMessage(props.room, eventId);

		const elEvent = elRoomTimeline.value.querySelector(`[eventId="${eventId}"]`);
		if (!elEvent) return;

		// Scroll the event into view depending on the position option.
		elEvent.scrollIntoView();
		if (options.position == 'TopCenter') {
			elRoomTimeline.value.scrollTop -= (elRoomTimeline.value.clientHeight * 1) / 3;
		}

		// Style the event depending on the select option.
		if (options.select == 'Highlight') {
			elEvent.classList.add('highlighted');
			window.setTimeout(() => {
				elEvent.classList.remove('highlighted');
			}, 2000);
		}
	}

	function isScrolling() {
		if (!elRoomTimeline.value) return false;

		// isScrolling is true if the user scrolled up 1/3 of the timeline element height from the bottom or more.
		return elRoomTimeline.value.scrollTop + (4 / 3) * elRoomTimeline.value.clientHeight < elRoomTimeline.value.scrollHeight;
	}

	function newEventsExist(): boolean {
		return newestEventId !== props.room.timelineGetNewestEvent()?.event_id;
	}

	/**
	 * Sometimes, not enough messages are loaded by matrix-js-sdk because of other types of events (for example, a room rename event) being loaded.
	 * This function loads around 15 messages if there are that many.
	 *
	 */
	async function loadInitialEvents() {
		let numLoadedMessages = props.room.timelineGetNumMessageEvents();
		let allMessagesLoaded = false;

		while (numLoadedMessages < 150 && !allMessagesLoaded) {
			allMessagesLoaded = await pubhubs.loadOlderEvents(props.room);
			numLoadedMessages = props.room.timelineGetNumMessageEvents();
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
