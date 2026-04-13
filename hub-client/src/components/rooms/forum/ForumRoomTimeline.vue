<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-y-scroll p-4"
	>
		<div class="mb-2 flex items-center justify-between gap-2 px-5">
			<div class="flex items-center gap-2">
				<PostsFilterButton />
				<AddNewPostButton />
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
				v-for="event in events"
				:key="event.matrixEvent.event_id"
			>
				<ForumThreadItem
					:event="event.matrixEvent.event"
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
	import { computed, onMounted, ref } from 'vue';

	import AddNewPostButton from '@hub-client/components/rooms/forum/AddNewPostButton.vue';
	// Components
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';
	import PostsFilterButton from '@hub-client/components/rooms/forum/PostsFilterButton.vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	// Models
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

	const initialLoadComplete = ref(false);
	const orderType = ref(ORDER.Created);
	const orderDir = ref(ORDER_DIR.asc);

	onMounted(() => {
		initialLoadComplete.value = true;
	});

	const events = computed(() => {
		let timeline = [] as TimelineEvent[];
		if (orderType.value === ORDER.Created) {
			if (orderDir.value === ORDER_DIR.desc) {
				timeline = props.room.getChronologicalTimeline();
			} else {
				timeline = props.room.getChronologicalTimelineAsc();
			}
		} else {
			// order by last timestamp per thread
			const rawTimeline = props.room.getTimeline();
			timeline = rawTimeline.sort((a, b) => {
				const tsa = props.room.getMatrixThreadLastEventTimestamp(a.matrixEvent.event.event_id!)!;
				const tsb = props.room.getMatrixThreadLastEventTimestamp(b.matrixEvent.event.event_id!)!;
				if (orderDir.value === ORDER_DIR.asc) {
					return tsb - tsa;
				}
				return tsa - tsb;
			});
		}
		return timeline;
	});

	const currentTopic = computed(() => {
		if (events.value.length > 0 && props.topicId) {
			const topic = events.value.find((t) => t.matrixEvent.event.event_id === props.topicId);
			return topic?.matrixEvent.event;
		}
		return undefined;
	});

	const orderIcon = (orderOption: ORDER): string => {
		if (orderOption === orderType.value) {
			if (orderDir.value === ORDER_DIR.asc) {
				return 'arrow-up';
			} else {
				return 'arrow-down';
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
