<template>
	<div v-if="!topicId" class="mx-auto w-full overflow-y-scroll p-4">
		<SubheaderForum />
		<ul v-if="topics.length > 0" class="flex flex-col gap-y-2">
			<li v-for="topic in topics" :key="topic.eventId">
				<ForumThreadItem :topic="topic" :room="room"></ForumThreadItem>
			</li>
		</ul>
	</div>
	<ForumThread v-if="currentTopic" :topic="currentTopic" :room="room"></ForumThread>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	// Components
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';

	// Composables
	import { useForum } from '@hub-client/composables/forum.composable';

	// Logic
	import { TThread } from '@hub-client/models/events/forum/TThread';
	// Models
	import Room from '@hub-client/models/rooms/Room';

	const forum = useForum();
	const initialLoadComplete = ref(false);

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		topicId: {
			type: String,
		},
	});

	onMounted(() => {
		initialLoadComplete.value = true;
	});

	const topics = computed(() => {
		const threadMap = new Map<string, TThread>();
		for (const event of props.room.getChronologicalTimeline()) {
			const thread = forum.transformTopic(event)!;
			threadMap.set(thread.eventId, thread);
		}
		// console.info('Map', threadMap);
		let topics = Array.from(threadMap.values());
		// console.info('Topics', topics);
		return topics;
	});

	const currentTopic = computed(() => {
		if (topics.value.length > 0 && props.topicId) {
			const topic = topics.value.find((t) => t.eventId === props.topicId);
			return topic;
		}
		return undefined;
	});

	// 	// Add ratings and replies to topics
	// 	let topics = Array.from(threadMap.values()).filter((t) => t.title !== '');
	// 	for (let i = 0; i < topics.length; i++) {
	// 		const topic = topics[i];
	// 		const ratings = getRatingsForEvent(topic.eventId);
	// 		topics[i].likes = ratings.likes;
	// 		topics[i].dislikes = ratings.dislikes;
	// 		const replies = getRepliesForEvent(topic.eventId);
	// 		topics[i].replies = replies ?? [];
	// 	}
	// 	return topics;
	// });

	// const getRepliesForEvent = (eventId: string): TThread[] => {
	// 	let replies = [] as TThread[];
	// 	props.room.getForumReplies().forEach((replyEvent) => {
	// 		if (replyEvent.matrixEvent.event.content && replyEvent.matrixEvent.event.content['m.relates_to']) {
	// 			const repliesTo = replyEvent.matrixEvent.event.content['m.relates_to'];
	// 			if (repliesTo['m.in_reply_to']) {
	// 				if (repliesTo['m.in_reply_to'].main_event_id === eventId) {
	// 					const reply: TThread = {
	// 						eventId: replyEvent.matrixEvent.event.event_id!,
	// 						likes: 0,
	// 						dislikes: 0,
	// 						author: pubhubs.client.getUser(replyEvent.matrixEvent.getSender()!),
	// 						title: '',
	// 						body: '',
	// 						closed: false,
	// 						timestamp: replyEvent.matrixEvent.getTs(),
	// 						replies: [],
	// 					};
	// 					replies.push(reply);
	// 				}
	// 			}
	// 		}
	// 	});
	// 	return replies;
	// };

	// const getRatingsForEvent = (eventId: string): { likes: number; dislikes: number } => {
	// 	let likes = 0;
	// 	let dislikes = 0;
	// 	props.room.getForumRatings().forEach((rateEvent) => {
	// 		if (rateEvent.matrixEvent.event.content && rateEvent.matrixEvent.event.content['m.relates_to']) {
	// 			const relatesTo = rateEvent.matrixEvent.event.content['m.relates_to'];
	// 			if (relatesTo.event_id === eventId) {
	// 				// const accum = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
	// 				if (relatesTo.key === 'like') likes++;
	// 				else if (relatesTo.key === 'dislike') dislikes++;
	// 			}
	// 		}
	// 	});
	// 	return { likes: likes, dislikes: dislikes };
	// };
</script>
