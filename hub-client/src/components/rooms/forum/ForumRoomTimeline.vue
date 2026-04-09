<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-y-scroll p-4"
	>
		<SubheaderForum />
		<ul
			v-if="topics.length > 0"
			class="flex flex-col gap-y-2"
		>
			<li
				v-for="topic in topics"
				:key="topic.eventId"
			>
				<ForumThreadItem
					:topic="topic"
					:room="room"
				></ForumThreadItem>
			</li>
		</ul>
	</div>
	<ForumThread
		v-if="currentTopic"
		:topic="currentTopic"
		:room="room"
	></ForumThread>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Components
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';

	// Composables
	import { useForum } from '@hub-client/composables/forum.composable';

	// Logic
	import { type TThread } from '@hub-client/models/events/forum/TThread';
	// Models
	import Room from '@hub-client/models/rooms/Room';

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
	const forum = useForum();
	const initialLoadComplete = ref(false);

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
</script>
