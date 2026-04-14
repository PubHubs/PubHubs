<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-1">
				<template v-if="lastTimestamp > 0">
					<EventTime
						:timestamp="lastTimestamp"
						:show-date="true"
					></EventTime>
					<EventTime
						:timestamp="lastTimestamp"
						:show-date="false"
					></EventTime>
				</template>
				<Icon type="chat-circle-text" />
				<span>{{ nrOfReplies }}</span>
			</div>
			<div>
				<Icon
					v-if="event.closed"
					type="lock"
				/>
				<Icon
					v-else
					type="lock-open"
					class="text-accent-secondary"
				/>
			</div>
			<ActionMenu v-if="currentUserIsTopicAuthor">
				<ActionMenuItem
					v-if="!event.closed"
					@click.stop="closeOrOpenTopic(true)"
					>Close</ActionMenuItem
				>
				<ActionMenuItem
					v-else
					@click.stop="closeOrOpenTopic(false)"
					>Open</ActionMenuItem
				>
				<ActionMenuItem @click.stop="deleteTopic(event.event_id)">Delete</ActionMenuItem>
				<ActionMenuItem @click.stop="editTopic(event.event_id)">Edit</ActionMenuItem>
			</ActionMenu>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	import { useUser } from '@hub-client/stores/user';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
		lastTimestamp: {
			type: Number,
			default: 0,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	const currentUser = useUser().user;

	const nrOfReplies = computed(() => {
		let count = 0;
		const currentThreadId = props.room.getCurrentThreadId();
		if (currentThreadId !== props.event.event_id && props.event.event_id) props.room.setCurrentThreadId(props.event.event_id);
		count = props.room.getCurrentThreadLength() - 1;
		if (currentThreadId !== props.event.event_id) props.room.setCurrentThreadId(currentThreadId);
		return count;
	});

	const currentUserIsTopicAuthor = computed(() => currentUser.userId === props.event.author?.userId);

	const closeOrOpenTopic = (close: boolean) => {
		// eslint-disable-next-line -- temp code
		console.info('closeOrOpenTopic', close);
	};

	const editTopic = (eventId: string) => {
		// eslint-disable-next-line -- temp code
		console.info('editTopic', eventId);
	};

	const deleteTopic = (eventId: string) => {
		// eslint-disable-next-line -- temp code
		console.info('deleteTopic', eventId);
	};
</script>
