<template>
	<div ref="elThreadTimeline" class="flex h-full w-full flex-col" data-testid="thread-sidekick">
		<!-- Thread message list -->
		<div class="h-full flex-1 overflow-y-scroll pt-4 pb-8">
			<!-- Root event -->
			<div v-if="filteredEvents.length === 0" ref="elRoomEvent" :id="props.room.currentThread?.rootEvent?.event.event_id">
				<RoomMessageBubble
					:room="room"
					:event="props.room.currentThread?.rootEvent?.event"
					:viewFromThread="true"
					:active-reaction-panel="activeReactionPanel"
					class="room-event"
					@in-reply-to-click="onInReplyToClick"
					@delete-message="confirmDeleteMessage"
					@reaction-panel-toggle="toggleReactionPanel"
					@reaction-panel-close="closeReactionPanel"
					@clicked-emoticon="sendEmoji"
				>
				</RoomMessageBubble>
			</div>

			<!-- Thread replies -->
			<div v-for="item in filteredEvents" :key="item.matrixEvent.event.event_id">
				<div class="mx-3 rounded-md" ref="elRoomEvent" :id="item.matrixEvent.event.event_id">
					<RoomMessageBubble
						:room="room"
						:event="item.matrixEvent.event"
						:viewFromThread="true"
						:active-reaction-panel="activeReactionPanel"
						class="room-event"
						@clicked-emoticon="sendEmoji"
						@in-reply-to-click="onInReplyToClick"
						@delete-message="confirmDeleteMessage"
						@reaction-panel-toggle="toggleReactionPanel"
						@reaction-panel-close="closeReactionPanel"
					></RoomMessageBubble>

					<!-- Reaction display for message -->
					<div class="flex flex-wrap gap-2 px-20">
						<Reaction v-if="reactionExistsForMessage(item)" :reactEvent="onlyReactionEvent(item.matrixEvent.event.event_id!)" :messageEventId="item.matrixEvent.event.event_id" />
					</div>
				</div>
			</div>
		</div>

		<!-- Thread input -->
		<MessageInput class="z-10 -mt-4" v-if="room" :room="room" :in-thread="true"></MessageInput>
	</div>

	<!-- Delete message dialog -->
	<DeleteMessageDialog v-if="showConfirmDelMsgDialog" :event="eventToBeDeleted" :room="room" :view-from-thread="true" @close="showConfirmDelMsgDialog = false" @yes="deleteMessage(eventToBeDeleted)"></DeleteMessageDialog>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, MatrixEvent } from 'matrix-js-sdk';
	import { Reactive, computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

	// Components
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { MatrixEventType, RelationType, RoomEmit, ScrollPosition, ScrollSelect } from '@hub-client/models/constants';
	import { TMessageEvent, TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import Room from '@hub-client/models/rooms/Room';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		scrollToEventId: String,
	});

	const pubhubs = usePubhubsStore();

	let deletedEvents: Reactive<MatrixEvent[]> = reactive<MatrixEvent[]>([]);
	let threadEvents: Reactive<TimelineEvent[]> = reactive<TimelineEvent[]>([]);
	const emit = defineEmits([RoomEmit.ThreadLengthChanged, RoomEmit.ScrolledToEventId]);

	const activeReactionPanel = ref<string | null>(null);

	const filteredEvents = computed(() => {
		return threadEvents.filter((event) => !event.isDeleted && event.matrixEvent.getType() !== EventType.Reaction);
	});

	const numberOfThreadEvents = computed(() => Math.max(filteredEvents.value.length, 1));

	function onlyReactionEvent(eventId: string) {
		// To stop from having duplicate events
		props.room.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation }).forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent.matrixEvent));
		return props.room.getCurrentEventRelatedEvents();
	}

	watch(
		() => props.room.threadUpdated,
		() => getThreadEvents(),
	);

	watch(
		() => props.room.currentThread?.threadId,
		() => changeThreadId(),
		{ immediate: true },
	);

	watch(
		() => props.scrollToEventId,
		(newValue, oldValue) => {
			nextTick(() => onScrollToEventId(newValue, oldValue));
		},
		{ immediate: true },
	);

	watch(
		() => filteredEvents.value.length,
		() => emit(RoomEmit.ThreadLengthChanged, numberOfThreadEvents.value),
	);

	const elThreadTimeline = ref<HTMLElement | null>(null);
	const showConfirmDelMsgDialog = ref(false);
	const eventToBeDeleted = ref<TMessageEvent>();

	onMounted(() => {
		LOGGER.log(SMI.ROOM_THREAD, 'RoomThread mounted');
	});

	onUnmounted(() => {
		closeThread();
	});

	function closeThread() {
		props.room.setCurrentThreadId(undefined);
	}

	async function changeThreadId() {
		await getThreadEvents();
		if (props.room.getCurrentEvent()) {
			scrollToEvent(props.room.getCurrentEvent()!.eventId, { position: ScrollPosition.Center, select: ScrollSelect.Highlight });
		} else {
			const lastEvent = filteredEvents.value[filteredEvents.value.length - 1];
			if (lastEvent?.matrixEvent.event?.event_id) {
				scrollToEvent(lastEvent.matrixEvent.event.event_id, { position: ScrollPosition.End });
			}
		}
	}

	async function onScrollToEventId(newEventId?: string, oldEventId?: string) {
		if (!newEventId) return;
		scrollToEvent(newEventId, { position: ScrollPosition.Center, select: ScrollSelect.Highlight });
	}

	async function getThreadEvents() {
		const events = await props.room.getCurrentThreadEvents();
		threadEvents.splice(0, threadEvents.length, ...events);

		if (threadEvents.length > 0) {
			nextTick(() => scrollToEvent(threadEvents[threadEvents.length - 1].matrixEvent.event.event_id!));
		}
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, { position: ScrollPosition.Center, select: ScrollSelect.Highlight });
	}

	async function scrollToEvent(eventId: string, options: { position: ScrollPosition.Start | ScrollPosition.Center | ScrollPosition.End; select?: ScrollSelect.Highlight | ScrollSelect.Select } = { position: ScrollPosition.Start }) {
		LOGGER.log(SMI.ROOM_THREAD, `scroll to event: ${eventId}`, { eventId });

		const doScroll = (elEvent: Element) => {
			elEvent.scrollIntoView({ block: options.position });
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
			let deletedEvent = threadEvents.find((e) => e.matrixEvent.event.event_id === event.event_id);
			props.room.deleteThreadMessage(event, deletedEvent?.matrixEvent.threadRootId);
			if (deletedEvent) {
				deletedEvents.push(deletedEvent.matrixEvent as MatrixEvent);
			}
		}
	}

	function toggleReactionPanel(eventId: string) {
		activeReactionPanel.value = activeReactionPanel.value === eventId ? null : eventId;
	}
	function closeReactionPanel() {
		activeReactionPanel.value = null;
	}

	async function sendEmoji(emoji: string, eventId: string) {
		await pubhubs.addReactEvent(props.room.roomId, eventId, emoji);
	}

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
			return !!relatesTo?.key;
		}

		return false;
	}
</script>
