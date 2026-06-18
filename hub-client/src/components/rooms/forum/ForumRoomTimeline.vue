<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-x-hidden overflow-y-scroll p-200"
	>
		<div class="mb-100 flex items-center justify-between gap-100 px-250">
			<div class="flex items-center gap-100">
				<Button
					icon="plus"
					:variant="addNewThread ? 'primary' : 'secondary'"
					@click="toggleNewThread()"
					>{{ $t('message.forum.add_new_thread') }}</Button
				>
			</div>
			<div class="flex items-center gap-100">
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
				class="flex h-full min-h-600 items-center justify-center px-200 md:px-800"
			>
				<InlineSpinner />
			</div>

			<ul
				v-if="events.length > 0"
				class="flex flex-col gap-y-100"
				data-testid="forum-thread-list"
			>
				<li
					v-for="tEvent in orderedEvents"
					:key="tEvent.matrixEvent.event.event_id"
					:data-thread-id="tEvent.matrixEvent.event.event_id"
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
		v-if="currentTopicEvent"
		:event="currentTopicEvent"
		:room="room"
	></ForumThread>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ForumCreateThread from '@hub-client/components/rooms/forum/ForumCreateThread.vue';
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';
	import ForumThreadItem from '@hub-client/components/rooms/forum/ForumThreadItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	// Models
	import type Room from '@hub-client/models/rooms/Room';

	const props = withDefaults(
		defineProps<{
			room: Room;
			topicId?: string | undefined;
		}>(),
		{
			topicId: undefined,
		},
	);

	enum ORDER {
		Activity = 'activity',
		Replies = 'replies',
		Created = 'created',
	}
	enum ORDER_DIR {
		desc = -1,
		asc = 1,
	}

	const addNewThread = ref(false);
	const orderType = ref(ORDER.Created);
	const orderDir = ref(ORDER_DIR.asc);

	const events = computed(() => {
		void props.topicId; // react also on changing topicId -> possibly a new event added somewhere, so timestamp etc needs to be updated.
		return props.room.getTimeline();
	});

	const orderedEvents = computed(() => {
		const ordered = [...events.value];
		ordered.sort((a, b) => {
			if (orderType.value === ORDER.Created) {
				if (orderDir.value === ORDER_DIR.desc) {
					return a.matrixEvent.getTs() - b.matrixEvent.getTs();
				} else {
					return b.matrixEvent.getTs() - a.matrixEvent.getTs();
				}
			}
			if (orderType.value === ORDER.Activity) {
				return orderDir.value === ORDER_DIR.asc
					? b.latestThreadEventTimestamp - a.latestThreadEventTimestamp
					: a.latestThreadEventTimestamp - b.latestThreadEventTimestamp;
			}
			if (orderType.value === ORDER.Replies) {
				const ar = (a.threadLength ?? 0) as unknown as number;
				const br = (b.threadLength ?? 0) as unknown as number;
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

	const currentTopicEvent = computed<TimelineEvent | undefined>(() => {
		if (events.value.length > 0 && props.topicId) {
			return events.value.find((t) => t.matrixEvent.getId() === props.topicId);
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
