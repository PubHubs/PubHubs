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
					:icon="orderIcon(ORDER.Activity)"
					variant="secondary"
					@click="setOrder(ORDER.Activity)"
					>Last Activity</Button
				>
				<Button
					:icon="orderIcon(ORDER.Created)"
					variant="secondary"
					@click="setOrder(ORDER.Created)"
					>Created</Button
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
	const orderDir = ref(ORDER_DIR.desc);

	onMounted(() => {
		initialLoadComplete.value = true;
	});

	const events = computed(() => {
		return props.room.getChronologicalTimeline();
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
		return 'arrows-down-up';
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
