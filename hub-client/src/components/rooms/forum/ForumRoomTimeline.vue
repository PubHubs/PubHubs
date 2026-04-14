<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-y-scroll p-4"
	>
		<div class="mb-2 flex items-center justify-between gap-2 px-5">
			<div class="flex items-center gap-2">
				<Button
					icon="plus"
					@click="$router.push({ name: 'create-topic' })"
					>Add New</Button
				>
			</div>
			<div class="flex items-center gap-2">
				<span>Sort by:</span>
				<Button
					v-for="order in ORDER"
					:key="order"
					:icon="orderIcon(order)"
					:variant="order === orderType ? 'primary' : 'secondary'"
					@click="setOrder(order)"
					>{{ order }}</Button
				>
			</div>
		</div>

		<ul
			v-if="events.length > 0"
			class="flex flex-col gap-y-2"
		>
			<li
				v-for="tEvent in events"
				:key="tEvent.event.matrixEvent.event.event_id"
			>
				<ForumThreadItem
					:event="tEvent.event.matrixEvent.event"
					:last-timestamp="tEvent.timestamp"
					:room="room"
					:show-actions="false"
				></ForumThreadItem>
			</li>
		</ul>
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
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';

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

	const orderType = ref(ORDER.Activity);
	const orderDir = ref(ORDER_DIR.asc);

	const events = computed(() => {
		const rawTimeline = props.room.getTimeline();
		let timelineWithTimeStamps = [] as TimeLineEventWithLastTimestamp[];
		timelineWithTimeStamps = rawTimeline.map((event) => {
			return {
				event: event,
				timestamp: props.room.getMatrixThreadLastEventTimestamp(event.matrixEvent.event.event_id!)!,
			} as TimeLineEventWithLastTimestamp;
		});
		// sort
		timelineWithTimeStamps.sort((a, b) => {
			if (orderType.value === ORDER.Created) {
				if (orderDir.value === ORDER_DIR.desc) {
					return a.event.matrixEvent.getTs() - b.event.matrixEvent.getTs();
				} else {
					return b.event.matrixEvent.getTs() - a.event.matrixEvent.getTs();
				}
			}
			if (orderType.value === ORDER.Activity) {
				const tsa = props.room.getMatrixThreadLastEventTimestamp(a.event.matrixEvent.event.event_id!)!;
				const tsb = props.room.getMatrixThreadLastEventTimestamp(b.event.matrixEvent.event.event_id!)!;
				if (orderDir.value === ORDER_DIR.asc) {
					return tsb - tsa;
				} else {
					return tsa - tsb;
				}
			}
			return 0;
		});
		return timelineWithTimeStamps;
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
			if (orderType.value === ORDER.Activity) {
				orderType.value = ORDER.Created;
			} else {
				orderType.value = ORDER.Activity;
			}
			orderDir.value = ORDER_DIR.desc;
		}
	};
</script>
