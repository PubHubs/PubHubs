<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<Icon type="thumbs-up" />
				<span>{{ topic.likes }}</span>
			</div>
			<div class="flex items-center gap-2">
				<Icon type="thumbs-down" />
				<span>{{ topic.dislikes }}</span>
			</div>
			<div class="flex items-center gap-1">
				<Icon type="chat-circle-text" />
				<span>{{ nrOfReplies }}</span>
			</div>
			<div>
				<Icon v-if="topic.closed" type="lock" />
				<Icon v-else type="lock-open" class="text-accent-secondary" />
			</div>
			<ActionMenu v-if="actions && currentUserIsTopicAuthor">
				<ActionMenuItem v-if="!topic.closed" @click="closeOrOpenTopic(true)">Close</ActionMenuItem>
				<ActionMenuItem v-else @click="closeOrOpenTopic(false)">Open</ActionMenuItem>
				<ActionMenuItem @click="deleteTopic(topic.eventId)">Delete</ActionMenuItem>
				<ActionMenuItem @click="editTopic(topic.eventId)">Edit</ActionMenuItem>
			</ActionMenu>
		</div>
		<div class="flex justify-end" v-if="actions">
			<Icon type="arrow-bend-up-left"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	import Room from '@hub-client/models/rooms/Room';

	import { useUser } from '@hub-client/stores/user';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const currentUser = useUser().user;

	const nrOfReplies = ref(0);

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
		actions: {
			type: Boolean,
			default: true,
		},
	});

	onMounted(() => {
		props.room?.setCurrentThreadId(props.topic.eventId);
		nrOfReplies.value = props.room?.getCurrentThreadLength() ?? 0;
	});

	const currentUserIsTopicAuthor = computed(() => currentUser.userId === props.topic.author?.userId);

	const closeOrOpenTopic = (close: boolean) => {
		console.info('closeOrOpenTopic', close);
	};

	const editTopic = (eventId: string) => {
		console.info('editTopic', eventId);
	};

	const deleteTopic = (eventId: string) => {
		console.info('deleteTopic', eventId);
	};
</script>
