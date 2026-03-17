<template>
	<div v-if="topic" class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
		<TopicItem :topic="topic" :room="currentRoom" :current-user="currentUser" :main-topic="topic" />
		<LabelWithDescription class="ml-5" label-class="text-3xl"> Answers: {{ replies?.length }} </LabelWithDescription>
		<div>
			<TopicItem v-for="reply in replies" :key="reply.eventId" :topic="reply" :room="currentRoom" :current-user="currentUser" :replies="true" :main-topic="topic" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	// import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import TopicItem from '@hub-client/components/rooms/forum/TopicItem.vue';

	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { useRooms } from '@hub-client/stores/rooms';
	// import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

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
	const threadKey = route.params.topicId;
	const topic = computed(() => forumStore.forumTopics.find((t) => t.eventId === threadKey));
	const replies = computed(() => topic.value?.replies);
</script>
