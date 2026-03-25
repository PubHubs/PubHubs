<template>
	<div v-if="!topicId" class="mx-auto w-full pr-3 pl-3 md:w-2/3">
		<SubheaderForum />
		<template v-if="topics.length > 0">
			<ul class="flex flex-col gap-y-2">
				<li v-for="topic in topics" :key="topic.eventId">
					<ThreadItem @click="$router.push({ name: 'room', params: { id: props.room.roomId, topicId: topic.eventId } })" :topic="topic" :room="room" />
				</li>
			</ul>
		</template>
	</div>
	<ForumRoomTopic v-if="currentTopic" :topic="currentTopic" :room="room"></ForumRoomTopic>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	// Components
	import ForumRoomTopic from '@hub-client/components/rooms/forum/ForumRoomTopic.vue';
	import ThreadItem from '@hub-client/components/rooms/forum/ThreadItem.vue';

	// Composables

	// Logic
	import { TThread } from '@hub-client/models/events/forum/TThread';
	import { TTopicContent, TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const pubhubs = usePubhubsStore();

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
			const eventId = event.matrixEvent.getId()!;
			const content = event.matrixEvent.getContent() as TTopicContent | TTopicReplyContent;
			if (!eventId || !event.matrixEvent.getSender() || !content.body) continue;
			// skip edits
			if ('m.new_content' in content) continue;

			// const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
			// const isTopic = event.matrixEvent.getType() === PubHubsMgType.ForumTopic && (content as TTopicContent).ph_topic_title !== '';
			const isTopic = true;
			const user = pubhubs.client.getUser(event.matrixEvent.getSender()!);

			const thread: TThread = {
				eventId: eventId,
				likes: 0,
				dislikes: 0,
				author: user,
				title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
				body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
				closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
				timestamp: event.matrixEvent.getTs(),
				replies: [],
			};

			// // Replies / Thread
			// props.room.setCurrentThreadId(eventId);
			// const threadEvents = props.room.getCurrentThread();

			threadMap.set(eventId, thread);
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

	// const topics = computed(() => {
	// 	const threadMap = new Map<string, TThread>();
	// 	const ratingsByEvent = new Map<string, { likes: number; dislikes: number }>();

	// 	for (const event of props.room.getChronologicalTimeline()) {
	// 		const eventId = event.matrixEvent.getId()!;
	// 		const content = event.matrixEvent.getContent() as TTopicContent | TTopicReplyContent;
	// 		if (!eventId || !event.matrixEvent.getSender() || !content.body) continue;
	// 		// skip edits
	// 		if ('m.new_content' in content) continue;

	// 		const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
	// 		const isTopic = event.matrixEvent.getType() === PubHubsMgType.ForumTopic && (content as TTopicContent).ph_topic_title !== '';
	// 		const user = pubhubs.client.getUser(event.matrixEvent.getSender()!);

	// 		const thread: TThread = {
	// 			eventId: eventId,
	// 			likes,
	// 			dislikes,
	// 			author: user,
	// 			title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
	// 			body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
	// 			closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
	// 			timestamp: event.matrixEvent.getTs(),
	// 			replies: [],
	// 		};

	// 		threadMap.set(eventId, thread);
	// 	}

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
