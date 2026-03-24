<template>
	<div v-if="!topicId" class="mx-auto w-full pr-3 pl-3 md:w-2/3">
		<SubheaderForum />
		<template v-if="topics.length > 0">
			<ul class="flex flex-col gap-y-2">
				<li v-for="topic in topics" :key="topic.eventId">
					<ThreadItem @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" :topic="topic" />
				</li>
			</ul>
		</template>

		<!-- <div class="relative min-h-0 flex-1">
			<div v-if="room" ref="elRoomTimeline" class="flex h-full flex-col-reverse space-y-reverse overflow-x-hidden overflow-y-scroll overscroll-y-contain" style="overflow-anchor: none">
				<template v-if="roomTimeLine.length > 0">
					<div v-for="item in roomTimeLine">
						<Json :json="item.matrixEvent.event"></Json>
						<hr />
					</div>
				</template>
			</div>
		</div> -->
	</div>
</template>

<script setup lang="ts">
	import { Thread } from 'matrix-js-sdk';
	import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Components

	// Composables
	import useReadMarker from '@hub-client/composables/useReadMarker';
	import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';
	import { useTimelineScroll } from '@hub-client/composables/useTimelineScroll';

	// Logic
	// import { ElementObserver } from '@hub-client/logic/core/elementObserver';
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	import { TThread } from '@hub-client/models/events/forum/TThread';
	import { TTopicContent, TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
	// Models
	// import { RelationType, ScrollPosition, SystemDefaults, TimelineScrollConstants } from '@hub-client/models/constants';
	// import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	// import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	// import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const pubhubs = usePubhubsStore();

	const elRoomTimeline = ref<HTMLElement | null>(null);
	// const elRoomEvent = ref<HTMLElement | null>(null);
	const topSentinel = ref<HTMLElement | null>(null);
	const bottomSentinel = ref<HTMLElement | null>(null);
	// const showConfirmDelMsgDialog = ref(false);
	// const activeReactionPanel = ref<string | null>(null);
	// const eventToBeDeleted = ref<TMessageEvent>();
	// const editingPoll = ref<{ poll: Poll; eventId: string } | undefined>(undefined);
	// const editingScheduler = ref<{ scheduler: Scheduler; eventId: string } | undefined>(undefined);
	const initialLoadComplete = ref(false);

	// const { READ_DELAY_MS, PAGINATION_COOLDOWN } = TimelineScrollConstants;
	// const { messageGroupGap } = SystemDefaults;

	// let dateInformation = ref<number>(0);
	// let eventToBeDeletedIsThreadRoot: boolean = false;
	// let eventObserver: ElementObserver | null = null;
	// const isMobile = computed(() => settings.isMobileState);

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		topicId: {
			type: String,
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
	// const userHasScrolled = ref(true);

	/**
	 * Timeline in reverse order [newest, ..., oldest] for column-reverse rendering
	 */
	// const reversedTimeline = computed(() => {
	// 	timelineVersion.value; // Dependency to trigger re-computation
	// 	return [...props.room.getChronologicalTimeline()].reverse();
	// });

	/**
	 * Whether the message at `index` in `reversedTimeline` is a visual continuation
	 * of the previous message (same sender, no special types, within time gap).
	 */
	// function isGroupedMessage(index: number): boolean {
	// 	const current = reversedTimeline.value[index];
	// 	const previous = reversedTimeline.value[index + 1]; // Previous chronologically = next index in reversed array

	// 	if (!current || !previous) return false;
	// 	if (current.matrixEvent.event.sender !== previous.matrixEvent.event.sender) return false;

	// 	const currentMsgType = current.matrixEvent.event.content?.msgtype;
	// 	const previousMsgType = previous.matrixEvent.event.content?.msgtype;
	// 	if (currentMsgType === PubHubsMgType.AnnouncementMessage || previousMsgType === PubHubsMgType.AnnouncementMessage) return false;

	// 	const currentTs = current.matrixEvent.event.origin_server_ts || 0;
	// 	const previousTs = previous.matrixEvent.event.origin_server_ts || 0;
	// 	if (currentTs - previousTs > messageGroupGap) return false;

	// 	return true;
	// }

	// Whether the next chronological message continues the same group
	// function isFollowedByGrouped(index: number): boolean {
	// 	return index > 0 && isGroupedMessage(index - 1);
	// }

	// Timeline in chronological order [oldest, ..., newest]
	const roomTimeLine = computed(() => {
		timelineVersion.value; // Dependency to trigger re-computation
		return props.room.getChronologicalTimeline();
	});

	onMounted(() => {
		console.info('Oldest & Newest events loaded?', oldestEventIsLoaded.value, newestEventIsLoaded.value);

		console.info('= RoomTimeLine events', roomTimeLine.value.length);
		console.info('= Related', props.room.getRelatedEvents.length);
		console.info('# Topics', topics.value);
		console.info('# Replies', props.room.getForumReplies().length);
		console.info('# Ratings', props.room.getForumRatings().length);

		initialLoadComplete.value = true;
	});

	const topics = computed(() => {
		const threadMap = new Map<string, TThread>();
		// const replyBuckets = new Map<string, TThread[]>();
		const ratingsByEvent = new Map<string, { likes: number; dislikes: number }>();

		for (const event of roomTimeLine.value) {
			const eventId = event.matrixEvent.getId()!;
			const content = event.matrixEvent.getContent() as TTopicContent | TTopicReplyContent;
			if (!eventId || !event.matrixEvent.getSender() || !content.body) continue;
			// skip edits
			if ('m.new_content' in content) continue;

			const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
			const isTopic = event.matrixEvent.getType() === PubHubsMgType.ForumTopic && (content as TTopicContent).ph_topic_title !== '';
			const user = pubhubs.client.getUser(event.matrixEvent.getSender()!);

			const thread: TThread = {
				eventId: eventId,
				likes,
				dislikes,
				author: user,
				title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
				body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
				closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
				timestamp: event.matrixEvent.getTs(),
				replies: [],
			};

			threadMap.set(eventId, thread);
		}

		// Add ratings and replies to topics
		let topics = Array.from(threadMap.values()).filter((t) => t.title !== '');
		for (let i = 0; i < topics.length; i++) {
			const topic = topics[i];
			const ratings = getRatingsForEvent(topic.eventId);
			topics[i].likes = ratings.likes;
			topics[i].dislikes = ratings.dislikes;
			const replies = getRepliesForEvent(topic.eventId);
			topics[i].replies = replies ?? [];
		}
		return topics;
	});

	const getRepliesForEvent = (eventId: string): TThread[] => {
		let replies = [] as TThread[];
		props.room.getForumReplies().forEach((replyEvent) => {
			if (replyEvent.matrixEvent.event.content && replyEvent.matrixEvent.event.content['m.relates_to']) {
				const repliesTo = replyEvent.matrixEvent.event.content['m.relates_to'];
				if (repliesTo['m.in_reply_to']) {
					if (repliesTo['m.in_reply_to'].main_event_id === eventId) {
						const reply: TThread = {
							eventId: replyEvent.matrixEvent.event.event_id!,
							likes: 0,
							dislikes: 0,
							author: pubhubs.client.getUser(replyEvent.matrixEvent.getSender()!),
							title: '',
							body: '',
							closed: false,
							timestamp: replyEvent.matrixEvent.getTs(),
							replies: [],
						};
						replies.push(reply);
					}
				}
			}
		});
		return replies;
	};

	const getRatingsForEvent = (eventId: string): { likes: number; dislikes: number } => {
		let likes = 0;
		let dislikes = 0;
		props.room.getForumRatings().forEach((rateEvent) => {
			if (rateEvent.matrixEvent.event.content && rateEvent.matrixEvent.event.content['m.relates_to']) {
				const relatesTo = rateEvent.matrixEvent.event.content['m.relates_to'];
				if (relatesTo.event_id === eventId) {
					// const accum = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
					if (relatesTo.key === 'like') likes++;
					else if (relatesTo.key === 'dislike') dislikes++;
				}
			}
		});
		return { likes: likes, dislikes: dislikes };
	};

	// watch(() => roomTimeLine.value.length, onTimelineChange);

	// watch(
	// 	() => props.eventIdToScroll,
	// 	async (eventId) => {
	// 		if (!eventId) return;
	// 		// Only handle changes after initial scroll is complete
	// 		if (!isInitialScrollComplete.value) {
	// 			return;
	// 		}
	// 		console.error(`[RoomTimeline] eventIdToScroll watch: calling scrollToEvent for ${eventId}`);
	// 		// scrollToEvent(eventId, { position: ScrollPosition.Center, highlight: true });
	// 	},
	// );

	// watch(
	// 	() => props.room.getCurrentEvent(),
	// 	() => {
	// 		refreshTimelineVersion();
	// 		// setupEventIntersectionObserver();
	// 	},
	// 	{ deep: true },
	// );

	// function onlyReactionEvent(eventId: string) {
	// 	props.room.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation }).forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent.matrixEvent));
	// 	return props.room.getCurrentEventRelatedEvents();
	// }

	// function reactionExistsForMessage(timelineEvent: TimelineEvent): boolean {
	// 	if (timelineEvent.isDeleted || (timelineEvent.matrixEvent && timelineEvent.matrixEvent.isRedacted())) return false;
	// 	const messageEventId = timelineEvent.matrixEvent.event.event_id;
	// 	if (!messageEventId) return false;

	// 	const reactionEvent = onlyReactionEvent(messageEventId).find((event) => {
	// 		const relatesTo = event.getContent()[RelationType.RelatesTo];
	// 		return relatesTo && relatesTo.event_id === messageEventId;
	// 	});

	// 	if (reactionEvent) {
	// 		const relatesTo = reactionEvent.getContent()[RelationType.RelatesTo];
	// 		return relatesTo?.key ? true : false;
	// 	}

	// 	return false;
	// }

	// async function sendEmoji(emoji: string, eventId: string) {
	// 	await pubhubs.addReactEvent(props.room.roomId, eventId, emoji);
	// }

	// function setupEventIntersectionObserver() {
	// 	// Disconnect previous observer to prevent memory leaks
	// 	if (eventObserver) {
	// 		eventObserver.disconnectObserver();
	// 	}

	// 	eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

	// 	// Combined handler - ElementObserver only supports ONE callback (each setUpObserver replaces the previous)
	// 	const combinedHandler = (entries: IntersectionObserverEntry[]) => {
	// 		// Track visibility for read marker + send receipts (single unified handler)
	// 		handleVisibilityTracking(entries);

	// 		// Date displayer is separate UI concern
	// 		if (settings.isFeatureEnabled(FeatureFlag.dateSplitter)) {
	// 			handleDateDisplayer(entries);
	// 		}
	// 	};

	// 	eventObserver?.setUpObserver(combinedHandler);
	// }

	// /**
	//  * Tracks visible messages for read marker and notifications.
	//  */
	// const handleVisibilityTracking = (entries: IntersectionObserverEntry[]) => {
	// 	if (!isInitialScrollComplete.value || entries.length < 1) {
	// 		return;
	// 	}

	// 	let newestVisibleEventId: string | null = null;
	// 	let newestVisibleTimestamp = 0;

	// 	entries.forEach((entry) => {
	// 		const eventId = entry.target.id;
	// 		const matrixEvent = props.room.findEventById(eventId);

	// 		if (!matrixEvent || matrixEvent.getType() !== EventType.RoomMessage) {
	// 			return;
	// 		}

	// 		if (matrixEvent.localTimestamp > newestVisibleTimestamp) {
	// 			newestVisibleTimestamp = matrixEvent.localTimestamp;
	// 			newestVisibleEventId = eventId;
	// 		}
	// 	});

	// 	const currentTrackedTimestamp = props.room.getLastVisibleTimeStamp();

	// 	if (!newestVisibleEventId || newestVisibleTimestamp <= currentTrackedTimestamp) {
	// 		return;
	// 	}

	// 	const capturedEventId = newestVisibleEventId;
	// 	const capturedTimestamp = newestVisibleTimestamp;

	// 	setTimeout(() => {
	// 		const element = elRoomTimeline.value?.querySelector(`[id="${capturedEventId}"]`);
	// 		if (!element || !elRoomTimeline.value) {
	// 			return;
	// 		}

	// 		const containerRect = elRoomTimeline.value.getBoundingClientRect();
	// 		const elementRect = element.getBoundingClientRect();
	// 		const isStillVisible = elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.top;

	// 		if (!isStillVisible) {
	// 			return;
	// 		}

	// 		if (capturedTimestamp > props.room.getLastVisibleTimeStamp()) {
	// 			updateReadMarker(capturedEventId, capturedTimestamp);

	// 			if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
	// 				const lastVisibleEvent = props.room.findEventById(capturedEventId);
	// 				if (lastVisibleEvent) {
	// 					pubhubs.sendPrivateReceipt(lastVisibleEvent, props.room.roomId);
	// 				}
	// 			}
	// 		}
	// 	}, READ_DELAY_MS);
	// };

	// const handleDateDisplayer = (entries: IntersectionObserverEntry[]) => {
	// 	props.room.resetFirstVisibleEvent();
	// 	entries.forEach((entry) => {
	// 		const eventId = entry.target.id;
	// 		const matrixEvent = props.room.findEventById(eventId);
	// 		if (matrixEvent && matrixEvent.getType() === EventType.RoomMessage) {
	// 			if (props.room.getFirstVisibleTimeStamp() < matrixEvent.localTimestamp || props.room.getFirstVisibleTimeStamp() === 0) {
	// 				matrixEvent.event.event_id && props.room.setFirstVisibleEventId(matrixEvent.event.event_id);
	// 				props.room.setFirstVisibleTimeStamp(matrixEvent.localTimestamp);
	// 			}
	// 		}
	// 	});
	// 	const minTimeStamp = props.room.getFirstVisibleEventId();
	// 	const firstReadEvent = props.room.findEventById(minTimeStamp);
	// 	if (!firstReadEvent || firstReadEvent?.localTimestamp === 0) {
	// 		return;
	// 	}
	// 	dateInformation.value = firstReadEvent?.localTimestamp;
	// };

	// async function onTimelineChange(newTimelineLength?: number, oldTimelineLength?: number) {
	// 	if (typeof newTimelineLength !== 'number' || newTimelineLength < 0 || typeof oldTimelineLength !== 'number' || oldTimelineLength < 0) return;
	// 	if (!elRoomTimeline.value) return;

	// 	await rooms.waitForInitialRoomsLoaded();

	// 	if (!rooms.currentRoom) return;
	// 	if (!newestEventIsLoaded.value) return;

	// 	// Notify scroll composable about new messages (for indicator)
	// 	// Skip during pagination - these are old messages being loaded, not new ones
	// 	if (newTimelineLength > oldTimelineLength && oldTimelineLength > 0 && !isLoadingPrevious.value && !isLoadingNext.value) {
	// 		const timeline = props.room.getChronologicalTimeline();
	// 		const newMessages = timeline.slice(oldTimelineLength);

	// 		newMessages.forEach((item) => {
	// 			const eventId = item.matrixEvent.event.event_id;
	// 			const senderId = item.matrixEvent.event.sender;
	// 			if (eventId && senderId) {
	// 				handleNewMessage(eventId, senderId);
	// 			}
	// 		});
	// 	}

	// 	const lastEventMsgType = props.room.getLiveTimelineEvents().at(-1)?.getContent().msgtype;
	// 	if (typeof lastEventMsgType === 'string') {
	// 		if (lastEventMsgType in PubHubsInvisibleMsgType) {
	// 			return;
	// 		}
	// 	}

	// 	let newestEventId = props.room.getRoomNewestMessageId();

	// 	// Re-setup observer when timeline changes (ensures all handlers are attached)
	// 	if (newestEventId?.substring(0, 1) === '~') {
	// 		// Temporary event ID - wait for it to be replaced
	// 		// waitObservingEvent();
	// 	} else {
	// 		await nextTick();
	// 		// setupEventIntersectionObserver();
	// 	}

	// 	// If initial scroll hasn't happened yet and events just loaded, perform it now
	// 	if (!isInitialScrollComplete.value && oldTimelineLength === 0 && newTimelineLength > 0) {
	// 		await performInitialScroll({
	// 			explicitEventId: props.eventIdToScroll,
	// 			lastReadEventId: displayedReadMarker.value ?? props.lastReadEventId,
	// 		});
	// 		return;
	// 	}

	// 	LOGGER.log(SMI.ROOM_TIMELINE, `onTimelineChange ended`);
	// }

	// function onInReplyToClick(inReplyToId: string) {
	// 	scrollToEvent(inReplyToId, { position: ScrollPosition.Center, highlight: true });
	// }

	// function onEditPoll(poll: Poll, eventId: string) {
	// 	editingPoll.value = { poll, eventId };
	// }

	// function onEditScheduler(scheduler: Scheduler, eventId: string) {
	// 	editingScheduler.value = { scheduler, eventId };
	// }

	// function toggleReactionPanel(eventId: string) {
	// 	activeReactionPanel.value = activeReactionPanel.value === eventId ? null : eventId;
	// }

	// function closeReactionPanel() {
	// 	activeReactionPanel.value = null;
	// }

	// function confirmDeleteMessage(event: TMessageEvent, isThreadRoot: boolean) {
	// 	showConfirmDelMsgDialog.value = true;
	// 	eventToBeDeleted.value = event;
	// 	eventToBeDeletedIsThreadRoot = isThreadRoot;
	// }

	// async function deleteMessage() {
	// 	if (eventToBeDeleted.value) {
	// 		rooms.currentRoom?.deleteMessage(eventToBeDeleted.value, eventToBeDeletedIsThreadRoot);
	// 		LOGGER.log(SMI.ROOM_TIMELINE, `Deleted message with id ${eventToBeDeleted.value.event_id}`, { eventToBeDeleted });
	// 	}
	// }

	// function waitObservingEvent() {
	// 	let timer = setInterval(function () {
	// 		if (props.room.getLiveTimelineNewestEvent()?.event_id?.substring(0, 1) !== '~') {
	// 			// setupEventIntersectionObserver();
	// 			clearInterval(timer);
	// 		}
	// 	}, PAGINATION_COOLDOWN);
	// }
</script>
