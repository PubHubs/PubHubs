<template>
	<div ref="elThreadTimeline" class="flex h-full w-full flex-col pt-4" data-testid="thread-sidekick">
		<SidebarHeader :title="t('rooms.thread')" />
		<!-- Thread message list -->
		<div class="flex-1 overflow-y-scroll pb-4">
			<!-- Root event -->
			<div v-if="filteredEvents.length === 0" :id="threadRootId">
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
				<div :ref="setEventRef" class="mx-3 rounded-md" :id="item.matrixEvent.event.event_id">
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
	import { Reactive, computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	import useReadMarker from '@hub-client/composables/useReadMarker';

	import { ElementObserver } from '@hub-client/logic/core/elementObserver';
	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { RelationType, RoomEmit, ScrollPosition, ScrollSelect, TimelineScrollConstants } from '@hub-client/models/constants';
	import { TMessageEvent, TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import Room from '@hub-client/models/rooms/Room';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		scrollToEventId: String,
	});

	const threadRootId = computed(() => {
		return props.room.currentThread?.rootEvent?.event.event_id;
	});

	const filteredEvents = computed(() => {
		return threadEvents.filter((event) => !event.isDeleted && event.matrixEvent.getType() !== EventType.Reaction);
	});

	const numberOfThreadEvents = computed(() => Math.max(filteredEvents.value.length, 1));

	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const user = useUser();

	let deletedEvents: Reactive<MatrixEvent[]> = reactive<MatrixEvent[]>([]);
	let threadEvents: Reactive<TimelineEvent[]> = reactive<TimelineEvent[]>([]);
	let eventObserver: ElementObserver | null = null;
	const elRoomEvent = ref<HTMLElement | null>(null);
	const elThreadTimeline = ref<HTMLElement | null>(null);
	const showConfirmDelMsgDialog = ref(false);
	const eventToBeDeleted = ref<TMessageEvent>();
	const { update: updateReadMarker } = useReadMarker(props.room, user.userId || '', threadRootId.value);

	const activeReactionPanel = ref<string | null>(null);
	const { READ_DELAY_MS } = TimelineScrollConstants;

	const emit = defineEmits([RoomEmit.ThreadLengthChanged, RoomEmit.ScrolledToEventId]);

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

	onMounted(() => {
		LOGGER.log(SMI.ROOM_THREAD, 'RoomThread mounted');
		setupEventIntersectionObserver();
	});

	onBeforeUnmount(() => {
		// Cleanup event observer
		if (eventObserver) {
			eventObserver.disconnectObserver();
			eventObserver = null;
		}
	});

	onUnmounted(() => {
		closeThread();
	});

	function onlyReactionEvent(eventId: string) {
		// To stop from having duplicate events
		props.room.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation }).forEach((reactEvent) => props.room.addCurrentEventToRelatedEvent(reactEvent.matrixEvent));
		return props.room.getCurrentEventRelatedEvents();
	}

	// TODO Element Observer Because of the way the ElementObserver is set up we need elRoomEvent to be a single variable, but actually pass it as an array
	// Here we ignore the TypeScript errors for now until this is solved
	function setEventRef(el: Element | null | any) {
		if (el instanceof HTMLElement) {
			if (elRoomEvent.value) {
				// @ts-ignore
				elRoomEvent.value.push(el);
			} else {
				// @ts-ignore
				elRoomEvent.value = [el];
			}
		}
	}

	function findThreadEventById(eventId: string): MatrixEvent {
		return filteredEvents.value.find((x) => x.matrixEvent.event.event_id === eventId)?.matrixEvent as MatrixEvent;
	}

	function closeThread() {
		props.room.setCurrentThreadId(undefined);
	}

	async function changeThreadId() {
		await getThreadEvents();

		setupEventIntersectionObserver();

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

	function setupEventIntersectionObserver() {
		// Disconnect previous observer to prevent memory leaks
		if (eventObserver) {
			eventObserver.disconnectObserver();
		}

		eventObserver = elRoomEvent.value && new ElementObserver(elRoomEvent.value, { threshold: 0.95 });

		// Combined handler - ElementObserver only supports ONE callback (each setUpObserver replaces the previous)
		const combinedHandler = (entries: IntersectionObserverEntry[]) => {
			// Track visibility for read marker + send receipts (single unified handler)
			handleVisibilityTracking(entries);
		};

		eventObserver?.setUpObserver(combinedHandler);
	}

	/**
	 * Tracks visible messages for read marker and notifications.
	 */
	const handleVisibilityTracking = (entries: IntersectionObserverEntry[]) => {
		if (entries.length < 1) {
			return;
		}

		let newestVisibleEventId: string | null = null;
		let newestVisibleTimestamp = 0;

		entries.forEach((entry) => {
			const eventId = entry.target.id;
			const matrixEvent = findThreadEventById(eventId);

			if (!matrixEvent || matrixEvent.getType() !== EventType.RoomMessage) {
				return;
			}

			if (matrixEvent.localTimestamp > newestVisibleTimestamp) {
				newestVisibleTimestamp = matrixEvent.localTimestamp;
				newestVisibleEventId = eventId;
			}
		});

		const currentTrackedTimestamp = props.room.getLastVisibleTimeStamp(threadRootId.value);

		if (!newestVisibleEventId || newestVisibleTimestamp <= currentTrackedTimestamp) {
			return;
		}

		const capturedEventId = newestVisibleEventId;
		const capturedTimestamp = newestVisibleTimestamp;

		setTimeout(() => {
			const element = elThreadTimeline.value?.querySelector(`[id="${capturedEventId}"]`);
			if (!element || !elThreadTimeline.value) {
				return;
			}

			const containerRect = elThreadTimeline.value.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const isStillVisible = elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.top;

			if (!isStillVisible) {
				return;
			}

			if (capturedTimestamp > props.room.getLastVisibleTimeStamp(threadRootId.value)) {
				updateReadMarker(capturedEventId, capturedTimestamp);

				if (settings.isFeatureEnabled(FeatureFlag.notifications)) {
					const lastVisibleEvent = findThreadEventById(capturedEventId);
					if (lastVisibleEvent) {
						pubhubs.sendPrivateReceipt(lastVisibleEvent, props.room.roomId, threadRootId.value);
					}
				}
			}
		}, READ_DELAY_MS);
	};
</script>
