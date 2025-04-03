<template>
	<div ref="elThreadTimeline" class="relative flex h-full w-full shrink-0 flex-col border-l border-surface-high bg-background md:w-[33%]">
		<div class="m-3 mb-0 flex items-center gap-2 rounded-md bg-surface-low p-2">
			<button @click="closeThread" class="rounded-md p-1">
				<Icon :type="'arrow'" :size="'sm'"></Icon>
			</button>
			<p class="truncate text-nowrap ~text-label-tiny-min/label-tiny-max">Thread ({{ numberOfThreadEvents ?? 0 }})</p>
		</div>

		<div class="h-full flex-1 overflow-y-scroll pb-8 pt-4">
			<div v-if="filteredEvents.length === 0" ref="elRoomEvent" :id="props.room.currentThread?.rootEvent?.event.event_id">
				<RoomEvent :room="room" :event="props.room.currentThread?.rootEvent?.event" :viewFromThread="true" class="room-event" @in-reply-to-click="onInReplyToClick" @delete-message="confirmDeleteMessage"> </RoomEvent>
			</div>
			<div v-for="item in filteredEvents" :key="item.event.event_id">
				<div class="mx-3 overflow-hidden rounded-md" ref="elRoomEvent" :id="item.event.event_id">
					<RoomEvent :room="room" :event="item.event" :viewFromThread="true" class="room-event" @in-reply-to-click="onInReplyToClick" @delete-message="confirmDeleteMessage"></RoomEvent>
				</div>
			</div>
		</div>

		<MessageInput class="z-10 -mt-4" v-if="room" :room="room" :in-thread="true"></MessageInput>
	</div>
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="room" :view-from-thread="true" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage(eventToBeDeleted)"></DeleteMessageDialog>
</template>

<script setup lang="ts">
	import { onMounted, ref, computed, reactive, Reactive, watch, onUnmounted, nextTick } from 'vue';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import Room from '@/model/rooms/Room';
	import { RelationType, RoomEmit } from '@/model/constants';
	import MessageInput from '../forms/MessageInput.vue';
	import { TMessageEvent, TMessageEventContent } from '@/model/events/TMessageEvent';
	import { Thread } from 'matrix-js-sdk';
	import { useUser } from '@/logic/store/user';

	// Components
	import RoomEvent from './RoomEvent.vue';
	import DeleteMessageDialog from '../forms/DeleteMessageDialog.vue';
	import { MatrixEvent } from 'matrix-js-sdk';

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

	onMounted(() => {
		props.room.listenToThreadNewReply(newReplyListener.bind(this));
		props.room.listenToThreadUpdate(updateReplyListener.bind(this));
		LOGGER.log(SMI.ROOM_THREAD, `RoomThread mounted `);
	});

	onUnmounted(() => {
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
</script>
