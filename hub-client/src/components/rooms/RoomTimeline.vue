<template>
	<div id="room-timeline" ref="elRoomTimeline" class="h-full overflow-y-auto relative" @scroll="onScroll">
		<div class="fixed right-60 top-24">
			<DateDisplayer v-if="settings.isFeatureEnabled(featureFlagType.dateSplitter)" :scrollStatus="userHasScrolled" :eventTimeStamp="dateInformation.valueOf()"></DateDisplayer>
		</div>
		<div id="room-created-tag" v-if="oldestEventIsLoaded" class="rounded-xl flex items-center justify-center w-60 mx-auto mb-12 border border-solid border-black dark:border-white">{{ $t('rooms.roomCreated') }}</div>
		<template v-for="(item, index) in rooms.getRoomTimeLineWithPluginsCheck(room_id)" :key="index">
			<div ref="elRoomEvent" :id="item.event.event_id">
				<RoomEvent :event="item.event" class="room-event" @on-in-reply-to-click="onInReplyToClick"></RoomEvent>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, watch } from 'vue';
	import { Room, useRooms, useUser } from '@/store/store';
	import { useRoute } from 'vue-router';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { ElementObserver } from '@/core/elementObserver';
	import { MatrixEvent } from 'matrix-js-sdk';
	import DateDisplayer from '../ui/DateDisplayer.vue';
	import { useSettings, featureFlagType } from '@/store/store';
	const settings = useSettings();
	import { Ref } from 'vue';

	const rooms = useRooms();
	const user = useUser();
	const route = useRoute();
	const pubhubs = usePubHubs();

	const elRoomTimeline = ref<HTMLElement | null>(null);

	const elRoomEvent = ref<HTMLElement | null>(null);

	let newestEventId: string | undefined;
	// todo: move to Room class.
	let oldestEventIsLoaded: Ref<boolean> = ref(false);

	let timeStampEvent: TimeLineEventTimeStamp[] = [];

	let userHasScrolled: Ref<boolean> = ref(true);

	let dateInformation = ref<Number>(0);

	type TimeLineEventTimeStamp = {
		eventId: string;
		timeStamp: number;
	};

	type Props = {
		room_id: string;
	};

	const props = defineProps<Props>();

	let elementObserver: ElementObserver | null = null;

	onMounted(async () => {
		scrollStatus();

		setInterval(() => {
			if (userHasScrolled.value) {
				userHasScrolled.value = false;
			}
		}, 2000);

		// Instantiate ElementObserver with your target element when the element is fully in the viewport.
		elementObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 1.0 });

		//Date Display Interaction callback is based on feature flag
		settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);

		if (!rooms.currentRoomExists) return;
		await loadInitialEvents();
		scrollToBottom();

		newestEventId = rooms.currentRoom?.getLiveTimeline().getEvents().at(-1)?.event.event_id;

		await rooms.storeRoomNotice(rooms.currentRoom!.roomId);
	});

	// Watch for new messages.
	watch(
		() => elRoomEvent.value && elRoomEvent.value.length,
		() => {
			settings.isFeatureEnabled(featureFlagType.dateSplitter) && elementObserver?.setUpObserver(handleDateDisplayer);
		},
	);
	watch(() => rooms.currentRoom?.getLiveTimeline().getEvents().length, onTimelineChange);

	watch(route, async () => {
		if (rooms.currentRoomExists) {
			await rooms.storeRoomNotice(rooms.currentRoom!.roomId);
		}
	});

	const handleDateDisplayer = (entries: IntersectionObserverEntry[]) => {
		timeStampEvent = [];
		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent: MatrixEvent = rooms.currentRoom?.findEventById(eventId);
			if (matrixEvent.getType() === 'm.room.message') {
				timeStampEvent.push({ eventId: eventId, timeStamp: matrixEvent.localTimestamp });
			}
		});
		const minTimeStamp = minTimeStampForTimeLineEvent();
		const firstReadEvent = rooms.currentRoom?.findEventById(minTimeStamp.eventId);
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
		if (!newTimelineLength || !oldTimelineLength) return;
		if (!elRoomTimeline.value) return;
		if (!rooms.currentRoom) return;
		if (!newEventsExist()) return;

		const newEvents = rooms.currentRoom.getLiveTimeline().getEvents().slice(oldTimelineLength);

		if (!isScrolling() || Room.containsUserSentEvent(user.user.userId, newEvents)) {
			setTimeout(scrollToBottom, 100);
		}

		newestEventId = rooms.currentRoom.getNewestEventId();
	}

	//#region Events

	async function onScroll(ev: Event) {
		if (!(ev.target instanceof HTMLElement)) return;
		if (!rooms.currentRoom) return;

		rooms.currentRoom.setUserIsScrolling(isScrolling());

		// If scrolled to the top of the screen, load older events.
		if (ev.target.scrollTop === 0) {
			const prevOldestLoadedEventId = rooms.rooms[props.room_id]
				.getLiveTimeline()
				.getEvents()
				.find((event) => event.getType() == 'm.room.message')
				?.getId();
			oldestEventIsLoaded.value = await pubhubs.loadOlderEvents(rooms.currentRoomId);
			if (prevOldestLoadedEventId && !oldestEventIsLoaded.value) {
				scrollToEvent(prevOldestLoadedEventId);
			}
		}
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: 'TopCenter', select: 'Highlight' });
	}

	//#endregion
	function scrollToBottom() {
		elRoomTimeline.value?.scrollTo(0, elRoomTimeline.value.scrollHeight);
	}

	function scrollStatus() {
		if (!elRoomTimeline.value) return;
		elRoomTimeline.value.onscroll = () => (userHasScrolled.value = true);
	}

	async function scrollToEvent(eventId: string, options: { position: 'Top' | 'TopCenter'; select?: 'Highlight' | 'Select' } = { position: 'Top' }) {
		if (!elRoomTimeline.value) return;

		await pubhubs.loadToMessage(rooms.currentRoomId, eventId);

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
		if (!rooms.currentRoom) return false;
		return newestEventId !== rooms.currentRoom.getLiveTimeline().getEvents().at(-1)?.event.event_id;
	}

	/**
	 * Sometimes, not enough messages are loaded by matrix-js-sdk because of other types of events (for example, a room rename event) being loaded.
	 * This function loads around 15 messages if there are that many.
	 *
	 */
	async function loadInitialEvents() {
		if (!rooms.currentRoom) return;

		const isMessageEvent = (event: MatrixEvent) => event.event.type === 'm.room.message';

		let numLoadedMessages = rooms.currentRoom.getLiveTimeline().getEvents().filter(isMessageEvent).length;

		let allMessagesLoaded = false;

		while (numLoadedMessages < 15 && !allMessagesLoaded) {
			allMessagesLoaded = await pubhubs.loadOlderEvents(rooms.currentRoomId);
			numLoadedMessages = rooms.currentRoom.getLiveTimeline().getEvents().filter(isMessageEvent).length;
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
