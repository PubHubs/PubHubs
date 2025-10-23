<template>
	<div ref="elThreadTimeline" class="relative flex h-full w-full shrink-0 flex-col border-l border-surface-high bg-background md:w-[33%]" data-testid="thread-sidekick">
		<div class="m-3 mb-0 flex items-center gap-2 rounded-md bg-surface-low p-2">
			<button @click="closeThread" class="rounded-md p-1">
				<Icon type="arrow-left" :size="'sm'"></Icon>
			</button>
			<p class="truncate text-nowrap ~text-label-tiny-min/label-tiny-max">Thread ({{ numberOfThreadEvents ?? 0 }})</p>
		</div>

		<div class="h-full flex-1 overflow-y-scroll pb-8 pt-4">
			<div v-for="item in filteredEvents" :key="item.event.event_id">
				<div class="mx-3 rounded-md" ref="elRoomEvent" :id="item.event.event_id">
					<RoomMessageBubble
						v-if="item.getType() === EventType.RoomMessage"
						:room="room"
						:event="item.event"
						:viewFromThread="true"
						:active-profile-card="activeProfileCard"
						:activeReactionPanel="activeReactionPanel"
						class="room-event"
						@clicked-emoticon="sendEmoji"
						@in-reply-to-click="onInReplyToClick"
						@delete-message="confirmDeleteMessage"
						@profile-card-toggle="toggleProfileCard"
						@profile-card-close="closeProfileCard"
						@reaction-panel-toggle="toggleReactionPanel"
						@reaction-panel-close="closeReactionPanel"
					></RoomMessageBubble>
					<div class="flex flex-wrap gap-2 px-20">
						<Reaction v-if="reactionExistsForMessage(item.event.event_id)" :reactEvent="onlyReactionEvents" :messageEventId="item.event.event_id"></Reaction>
					</div>
				</div>
			</div>
		</div>

		<MessageInput class="z-10 -mt-4" v-if="room" :room="room" :in-thread="true"></MessageInput>
	</div>
	<DeleteMessageDialog
		v-if="showConfirmDelMsgDialog"
		:event="eventToBeDeleted"
		:room="room"
		:thread-reaction-event="onlyReactionEvents"
		:view-from-thread="true"
		@close="showConfirmDelMsgDialog = false"
		@yes="deleteMessage(eventToBeDeleted)"
	></DeleteMessageDialog>
</template>

<script setup lang="ts">
	import { onMounted, ref, computed, reactive, Reactive, watch, onUnmounted, nextTick } from 'vue';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import Room from '@/model/rooms/Room';
	import { RelationType, RoomEmit } from '@/model/constants';
	import MessageInput from '../forms/MessageInput.vue';
	import { TMessageEvent, TMessageEventContent } from '@/model/events/TMessageEvent';
	import { Thread, EventType, MatrixEvent } from 'matrix-js-sdk';
	import { useUser } from '@/logic/store/user';
	import { usePubHubs } from '@/logic/core/pubhubsStore';

	// Components
	import Reaction from '../ui/Reaction.vue';
	import RoomMessageBubble from './RoomMessageBubble.vue';
	import DeleteMessageDialog from '../forms/DeleteMessageDialog.vue';

	const pubhubs = usePubHubs();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		scrollToEventId: String,
	});

	let deletedEvents: Reactive<MatrixEvent[]> = reactive<MatrixEvent[]>([]);
	let threadEvents: Reactive<MatrixEvent[]> = reactive<MatrixEvent[]>([]);
	const user = useUser();
	const emit = defineEmits([RoomEmit.ThreadLengthChanged, RoomEmit.ScrolledToEventId]);

	const filteredEvents = computed(() => {
		// return all threadEvents that are not in the deletedEvents
		return threadEvents.filter((event) => !deletedEvents.some((deletedEvent) => deletedEvent.getId() === event.getId()));
	});

	const onlyReactionEvents = computed(() => {
		const rootEventId = props.room.currentThread?.rootEvent?.event.event_id;
		if (!rootEventId) return;
		const rootReactEvent = props.room.getReactionEvent(rootEventId);

		const filteredThreadEvents = filteredEvents.value.filter((event) => event.getType() === EventType.Reaction);

		return filteredThreadEvents.concat(rootReactEvent);
	});

	const numberOfThreadEvents = computed(() => {
		return filteredEvents.value.length - 1;
	});

	watch(
		() => props.room.currentThread?.threadId,
		() => {
			changeThreadId();
		},
		{ immediate: true },
	);

	// Watch for currently visible eventId
	watch(
		() => props.scrollToEventId,
		(newValue, oldValue) => {
			// nextTick to make sure the element is already rendered before scrolling
			nextTick(() => {
				onScrollToEventId(newValue, oldValue);
			});
		},
		{ immediate: true },
	);

	watch(
		() => filteredEvents.value.length,
		() => {
			emit(RoomEmit.ThreadLengthChanged, numberOfThreadEvents.value ?? 0);
		},
	);

	const elThreadTimeline = ref<HTMLElement | null>(null);
	const showConfirmDelMsgDialog = ref(false);
	const eventToBeDeleted = ref<TMessageEvent>();
	const activeProfileCard = ref<string | null>(null);
	const activeReactionPanel = ref<string | null>(null);

	onMounted(() => {
		props.room.listenToThreadNewReply(newReplyListener.bind(this));
		props.room.listenToThreadUpdate(updateReplyListener.bind(this));
		LOGGER.log(SMI.ROOM_THREAD, `RoomThread mounted `);
	});

	onUnmounted(() => {
		closeThread();
		props.room.stopListeningToThreadNewReply(newReplyListener.bind(this));
		props.room.stopListeningToThreadUpdate(updateReplyListener.bind(this));
	});

	function closeThread() {
		props.room.setCurrentThreadId(undefined);
	}

	/**
	 * Change the threadId to the current threadId of the room and jump to last event
	 */
	async function changeThreadId() {
		await getThreadEvents();
		if (props.room.getCurrentEventId()) {
			scrollToEvent(props.room.getCurrentEventId()!, { position: 'center', select: 'Highlight' });
		} else {
			const lastEvent = filteredEvents.value[filteredEvents.value.length - 1];
			if (lastEvent?.event?.event_id) {
				scrollToEvent(lastEvent.event.event_id, { position: 'end' });
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function onScrollToEventId(newEventId?: string, oldEventId?: string) {
		if (!newEventId) return;
		scrollToEvent(newEventId, { position: 'center', select: 'Highlight' });
	}

	/**
	 * Get the thread events from the room and set them to the threadEvents array
	 * At the moment all messages from the thread are loaded at once
	 * Possibly in the future depending of the size of threads this may have to be changed
	 */
	async function getThreadEvents() {
		await props.room.getCurrentThreadEvents().then((events) => {
			threadEvents.splice(0, threadEvents.length, ...events);
		});
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: 'center', select: 'Highlight' });
	}

	// parameters are not used, but needed to listen to the event, so:
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function newReplyListener(_thread: Thread, _threadEvent: MatrixEvent) {
		// make sure the thread is a valid thread
		props.room.AssureThread();

		// update thread events
		await getThreadEvents();
		const newestMessageEventId = threadEvents[threadEvents.length - 1]?.event.event_id;
		if (newestMessageEventId) {
			// Make sure the new event is in the timeline when the user is the sender and/or the previous newest event was visible
			const newestEvent = props.room.currentThread?.thread?.findEventById(newestMessageEventId)?.event;
			const messageSendByUser = newestEvent?.sender === user.user.userId;
			// When the new event is send by the user: scroll to the message
			if (messageSendByUser && newestEvent?.event_id) {
				await scrollToEvent(newestEvent.event_id);
			}
		}
	}

	// Listen to update event, also for deletion. Thread parameter is of current thread, not of changed one,
	// so we need to always perform this
	// parameters are not used, but needed to listen to the event, so:
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function updateReplyListener(thread: Thread) {
		props.room.AssureThread();
		await getThreadEvents();
		// check for events of which the related event does no longer exist and add them to the RedeactedEventIds to make sure they are correctly displayed
		threadEvents.forEach((event) => {
			const eventId = event.event?.content?.[RelationType.RelatesTo]?.[RelationType.InReplyTo]?.event_id;
			if (eventId) {
				if (!threadEvents.find((e) => e.event.event_id === eventId)) {
					props.room.addToRedactedEventIds(eventId);
				}
			}
		});
	}

	async function scrollToEvent(eventId: string, options: { position: 'start' | 'center' | 'end'; select?: 'Highlight' | 'Select' } = { position: 'start' }) {
		LOGGER.log(SMI.ROOM_THREAD, `scroll to event: ${eventId}`, { eventId });

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

		if (elThreadTimeline.value) {
			const elEvent = elThreadTimeline.value?.querySelector(`[id="${eventId}"]`);
			if (elEvent) {
				doScroll(elEvent);
				emit(RoomEmit.ScrolledToEventId);
			}
		}
	}

	function confirmDeleteMessage(event: TMessageEvent) {
		eventToBeDeleted.value = event;
		showConfirmDelMsgDialog.value = true;
	}

	function deleteMessage(event: TMessageEvent<TMessageEventContent> | undefined) {
		if (event) {
			let deletedEvent = threadEvents.find((e) => e.event.event_id === event.event_id);
			props.room.deleteThreadMessage(event, deletedEvent?.threadRootId);
			if (deletedEvent) {
				deletedEvents.push(deletedEvent as MatrixEvent);
			}
		}
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

	// Reaction regions ///

	async function sendEmoji(emoji: string, eventId: string) {
		await pubhubs.addReactEvent(props.room.roomId, eventId, emoji);
	}

	// Is there a reaction for RoomMessageEvent ID.
	// If there is then show the reaction otherwise dont render reaction UI component.
	function reactionExistsForMessage(messageEventId: string): boolean {
		if (!onlyReactionEvents.value) return false;
		const reactionEvent = onlyReactionEvents.value.find((event) => {
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

	// End Reaction regions ///
</script>
