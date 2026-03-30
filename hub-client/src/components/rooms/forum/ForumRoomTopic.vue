<template>
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
		<TopicItem :topic="topic" :room="room" :current-user="topic.author" :main-topic="topic" />
		<LabelWithDescription class="ml-5" label-class="text-3xl"> Answers: {{ nrOfReplies }} </LabelWithDescription>
		<div v-if="topicWithReplies.replies.length > 0">
			<TopicItem v-for="reply in topicWithReplies.replies" :key="reply.eventId" :topic="reply" :room="room" :current-user="topic.author" :replies="true" :main-topic="topic" />
		</div>
		<InlineSpinner v-else></InlineSpinner>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, reactive, ref } from 'vue';

	// Components
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import TopicItem from '@hub-client/components/rooms/forum/TopicItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	import { useForum } from '@hub-client/composables/forum.composable';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const forum = useForum();
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
	});

	const topicWithReplies = reactive(props.topic);

	onMounted(async () => {
		topicWithReplies.value = await forum.addReplies(props.topic, props.room);
		nrOfReplies.value = forum.nrOfReplies(topicWithReplies.value, props.room);
		// console.info('ForumRoomTopic.onMounted', props.topic.eventId, topicWithReplies.value.nrOfReplies);
	});
</script>
