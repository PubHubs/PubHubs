<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-x-hidden overflow-y-scroll p-4"
	>
		<div class="mb-2 flex items-center justify-between gap-2 px-5">
			<div class="flex items-center gap-2">
				<Button
					icon="plus"
					:variant="addNewThread ? 'primary' : 'secondary'"
					@click="toggleNewThread()"
					>{{ $t('message.forum.add_new_thread') }}</Button
				>
			</div>
			<div class="flex items-center gap-2">
				<span>{{ $t('message.forum.sortby') }}:</span>
				<Button
					v-for="order in ORDER"
					:key="order"
					:icon="orderIcon(order)"
					:variant="order === orderType ? 'primary' : 'secondary'"
					@click="setOrder(order)"
					>{{ $t('message.forum.sortby_' + order) }}</Button
				>
			</div>
		</div>

		<ForumCreateThread
			v-if="addNewThread"
			:id="room.roomId"
			@close="closeNewThread()"
		></ForumCreateThread>

		<div class="flex h-full flex-col">
			<!-- Loading indicator -->
			<div
				v-if="events.length === 0"
				class="flex h-full min-h-600 items-center justify-center px-4 md:px-16"
			>
				<InlineSpinner />
			</div>

			<ul
				v-if="events.length > 0"
				class="flex flex-col gap-y-2"
			>
				<li
					v-for="tEvent in orderedEvents"
					:key="tEvent.event.matrixEvent.event.event_id"
					:data-thread-id="tEvent.event.matrixEvent.event.event_id"
				>
					<div>
						<ForumThreadItem
							:event="tEvent"
							:room="room"
							:show-actions="false"
							@click="closeNewThread()"
						></ForumThreadItem>
					</div>
				</li>
			</ul>
		</div>
	</div>
	<ForumThread
		v-if="currentTopic"
		:event="currentTopic"
		:room="room"
	></ForumThread>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import ForumCreateThread from '@hub-client/components/rooms/forum/ForumCreateThread.vue';
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Models
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import Room from '@hub-client/models/rooms/Room';

	import Button from '@hub-client/new-design/components/Button.vue';

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		topicId: {
			type: String,
			default: undefined,
		},
	});

	enum ORDER {
		Activity = 'activity',
		Replies = 'replies',
		Created = 'created',
	}
	enum ORDER_DIR {
		desc = -1,
		asc = 1,
	}

	interface TimeLineEventWithLastTimestamp {
		event: TimelineEvent;
		timestamp: number;
	}

	const addNewThread = ref(false);
	const orderType = ref(ORDER.Created);
	const orderDir = ref(ORDER_DIR.asc);

	const events = computed(() => {
		void props.topicId; // react also on changing topicId -> possibly a new event added somewhere, so timestamp etc needs to be updated.
		const rawTimeline = props.room.getTimeline();
		let timelineWithTimeStamps = [] as TimeLineEventWithLastTimestamp[];
		timelineWithTimeStamps = rawTimeline.map((event) => {
			return {
				event: event,
				timestamp: props.room.getMatrixThreadLastEventTimestamp(event.matrixEvent.event.event_id!) ?? event.matrixEvent.getTs(),
			} as TimeLineEventWithLastTimestamp;
		});
		return timelineWithTimeStamps;
	});

	const orderedEvents = computed(() => {
		let ordered = events.value;
		ordered.sort((a, b) => {
			if (orderType.value === ORDER.Created) {
				if (orderDir.value === ORDER_DIR.desc) {
					return a.event.matrixEvent.getTs() - b.event.matrixEvent.getTs();
				} else {
					return b.event.matrixEvent.getTs() - a.event.matrixEvent.getTs();
				}
			}
			if (orderType.value === ORDER.Activity) {
				if (orderDir.value === ORDER_DIR.asc) {
					return b.timestamp - a.timestamp;
				} else {
					return a.timestamp - b.timestamp;
				}
			}
			if (orderType.value === ORDER.Replies) {
				const ar = (a.event.threadLength ?? 0) as unknown as number;
				const br = (b.event.threadLength ?? 0) as unknown as number;
				if (orderDir.value === ORDER_DIR.asc) {
					return br - ar;
				} else {
					return ar - br;
				}
			}
			return 0;
		});
		return ordered;
	});

	const currentTopic = computed(() => {
		if (events.value.length > 0 && props.topicId) {
			const topic = events.value.find((t) => t.event.matrixEvent.event.event_id === props.topicId);
			return topic?.event.matrixEvent.event;
		}
		return undefined;
	});

	const orderIcon = (orderOption: ORDER): string => {
		if (orderOption === orderType.value) {
			if (orderDir.value === ORDER_DIR.asc) {
				return 'arrow-down';
			} else {
				return 'arrow-up';
			}
		}
		return '';
	};

	const setOrder = (orderOption: ORDER) => {
		if (orderOption === orderType.value) {
			orderDir.value = orderDir.value * -1;
		} else {
			orderType.value = orderOption;
		}
	};

	const toggleNewThread = () => {
		addNewThread.value = !addNewThread.value;
	};

	const closeNewThread = () => {
		addNewThread.value = false;
	};
</script>
