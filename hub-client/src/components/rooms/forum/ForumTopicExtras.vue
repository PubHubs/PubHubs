<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-1">
				<Icon type="chat-circle-text" />
				<span>{{ nrOfReplies }}</span>
			</div>
			<div>
				<Icon
					v-if="topic.closed"
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
					v-if="!topic.closed"
					@click.stop="closeOrOpenTopic(true)"
					>Close</ActionMenuItem
				>
				<ActionMenuItem
					v-else
					@click.stop="closeOrOpenTopic(false)"
					>Open</ActionMenuItem
				>
				<ActionMenuItem @click.stop="deleteTopic(topic.eventId)">Delete</ActionMenuItem>
				<ActionMenuItem @click.stop="editTopic(topic.eventId)">Edit</ActionMenuItem>
			</ActionMenu>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Components
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	import { useUser } from '@hub-client/stores/user';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	// const emit = defineEmits(['reply']);

	const currentUser = useUser().user;

	const nrOfReplies = ref(0);

	onMounted(() => {
		const currentThreadId = props.room.getCurrentThreadId();
		if (currentThreadId !== props.topic.eventId && props.topic.eventId) props.room.setCurrentThreadId(props.topic.eventId);
		nrOfReplies.value = props.room.getCurrentThreadLength() - 1;
		if (currentThreadId !== props.topic.eventId) props.room.setCurrentThreadId(currentThreadId);
	});

	const currentUserIsTopicAuthor = computed(() => currentUser.userId === props.topic.author?.userId);

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
