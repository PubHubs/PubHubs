<template>
	<HeaderFooter v-if="topic">
		<template #header>
			<span v-if="topic.closed" class="text-center align-middle text-3xl font-bold">This topic is closed</span>
		</template>
		<TopicItem :topic="topic" :room="currentRoom" :current-user="currentUser" :main-topic="topic" />
		<LabelWithDescription class="ml-5" label-class="text-3xl"> Answers: {{ replies?.length }} </LabelWithDescription>
		<div>
			<TopicItem v-for="reply in replies" :key="reply.eventId" :topic="reply" :room="currentRoom" :current-user="currentUser" :replies="true" :main-topic="topic" />
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import { useRooms } from '@/logic/store/rooms';
	import { useUser } from '@/logic/store/user';
	import LabelWithDescription from '@/plugins/PluginRoomTypeForum/components/forms/LabelWithDescription.vue';
	import TopicItem from '@/plugins/PluginRoomTypeForum/components/rooms/TopicItem.vue';
	import { useForumStore } from '@/plugins/PluginRoomTypeForum/core/forumStore';
	import { computed } from 'vue';
	import { useRoute } from 'vue-router';

	//import { FILTER_STATE, useFilterStore } from '@/plugins/PluginRoomTypeForum/core/filterStore';
	//import { useTimelineStore } from '@/plugins/PluginRoomTypeForum/core/timelineStore';

	/*const filterStore = useFilterStore();
	const timelineStore = useTimelineStore();
	if (filterStore.filter === FILTER_STATE.MY_TOPICS) {
		timelineStore.createFilteredTimelineWindow(filterStore.topicsAndReplyFilter);
		filterStore.filter = FILTER_STATE.NO;
	}*/

	const forumStore = useForumStore();

	const rooms = useRooms();
	const currentRoom = rooms.currentRoom!;

	const route = useRoute();
	const currentUser = useUser();
	const threadKey = route.params.key;
	const topic = computed(() => forumStore.forumTopics.find((t) => t.eventId === threadKey));
	const replies = computed(() => topic.value?.replies);
</script>
