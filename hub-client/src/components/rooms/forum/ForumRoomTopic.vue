<template>
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
		<TopicItem :topic="topic" :room="room" :current-user="topic.author" :main-topic="topic" />
		<LabelWithDescription class="ml-5" label-class="text-3xl"> Answers: {{ nrOfReplies }} </LabelWithDescription>
		<div v-if="replies">
			<div v-for="reply in replies">{{ reply }}</div>
			<!-- <TopicItem v-for="reply in replies" :key="reply.eventId" :topic="reply" :room="room" :current-user="topic.author" :replies="true" :main-topic="topic" /> -->
		</div>
		<InlineSpinner v-else></InlineSpinner>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	import Json from '@hub-client/components/elements/Json.vue';
	// Components
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import TopicItem from '@hub-client/components/rooms/forum/TopicItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Models
	// import { TThread } from '@hub-client/models/events/forum/TThread';
	import Room from '@hub-client/models/rooms/Room';

	const replies = ref();
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

	onMounted(async () => {
		props.room?.setCurrentThreadId(props.topic.eventId);
		nrOfReplies.value = props.room?.getCurrentThreadLength() ?? 0;
		replies.value = await props.room?.getCurrentThreadEvents();
		console.info('ForumRoomTopic.onMounted', props.topic.eventId, nrOfReplies.value, replies.value);
	});
</script>
