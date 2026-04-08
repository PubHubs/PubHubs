<template>
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
		<ForumThreadItem
			:topic="topic"
			:room="room"
			@reply="replyTo($event)"
		></ForumThreadItem>
		<!-- <TopicItem
			:topic="topic"
			:room="room"
			:current-user="topic.author"
			:main-topic="topic"
		/> -->
		<LabelWithDescription label-class="text-3xl"> Answers: {{ nrOfReplies }} </LabelWithDescription>
		<div
			v-if="loadedReplies"
			class="ml-800"
		>
			<div
				v-for="reply in topicWithReplies.replies"
				:key="reply.eventId"
			>
				<RoomMessageBubble
					:event="reply.event!.matrixEvent.event"
					:room="room"
					:show-actions="false"
				>
					<template #extras>
						<ForumTopicExtras
							:topic="reply"
							:room="room"
						></ForumTopicExtras>
					</template>
					<template #bottom>
						<ForumBody :topic="topic"></ForumBody>
					</template>
				</RoomMessageBubble>
				<!-- <hr />
				<TopicItem :topic="reply" :room="room" :current-user="topic.author" :replies="true" :main-topic="topic" /> -->
			</div>
		</div>
		<MessageInput
			v-if="room"
			:room="room"
			:in-thread="true"
		></MessageInput>
		<InlineSpinner v-else></InlineSpinner>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref } from 'vue';

	// Components
	import ForumThreadItem from '@hub-client/components/rooms/forum/ForumThreadItem.vue';
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	// import TopicItem from '@hub-client/components/rooms/forum/TopicItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	import { useForum } from '@hub-client/composables/forum.composable';

	// Models
	import { type TThread } from '@hub-client/models/events/forum/TThread';
	import Room from '@hub-client/models/rooms/Room';

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
	const forum = useForum();
	const nrOfReplies = ref(0);
	const loadedReplies = ref(false);

	const topicWithReplies = ref<TThread>(props.topic as TThread);

	onMounted(async () => {
		nrOfReplies.value = forum.nrOfReplies(topicWithReplies.value, props.room);
		topicWithReplies.value = await forum.addReplies(topicWithReplies.value, props.room);
		loadedReplies.value = true;
	});

	const replyTo = (eventId: string) => {
		// eslint-disable-next-line -- temp code
		console.info('replyTo', eventId);
		// emit('reply', eventId);
	};
</script>
