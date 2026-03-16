<template>
	<div class="flex flex-row items-center gap-1 break-words">
		<button
			@click="togglePostsFilter"
			:class="['inline-flex items-center gap-2 rounded-[8px] px-4 py-[10px] font-bold transition-colors duration-300', isActive ? 'text-on-accent-primary bg-sky-900' : 'bg-accent-primary text-on-accent-primary hover:bg-sky-700']"
		>
			<Icon type="hamburger" size="sm" />
			<span>My Posts</span>
		</button>
	</div>
</template>

<script setup lang="ts">
	import { computed, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { FILTER_STATE, useFilterStore } from '@hub-client/stores/forum/filterStore';
	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	// import { useTimelineStore } from '@/plugins/PluginRoomTypeForum/core/timelineStore';
	// import { TimelineWindow } from 'matrix-js-sdk';

	const rooms = useRooms();
	const filterStore = useFilterStore();
	const forumStore = useForumStore();
	const myUserId = usePubhubsStore().client.getUserId();
	//const timelineStore = useTimelineStore();

	const isActive = computed(() => filterStore.filter === FILTER_STATE.MY_TOPICS);

	// Reset filter when switching rooms
	watch(
		() => rooms.currentRoomId,
		() => {
			filterStore.filter = FILTER_STATE.NO;
		},
	);

	// Note: The filter should be through timeline filter on sender, but the implementation now
	// filters by already fetched topics, because otherwise we would have to deal with 2 timelines and it will slow down
	// the app if we switch between them.
	// When you click on this button, and click on one of your posts, the comments of other people are not shown on the topic page, as they are not included in the filter.
	async function togglePostsFilter() {
		filterStore.filter = filterStore.filter === FILTER_STATE.MY_TOPICS ? FILTER_STATE.NO : FILTER_STATE.MY_TOPICS;
		if (filterStore.filter === FILTER_STATE.MY_TOPICS) {
			forumStore.myTopics = forumStore.forumTopics.filter((topic) => topic.author?.userId === myUserId);
			//timelineStore.createFilteredTimelineWindow(filterStore.topicsFilterWithId(myUserId as string));
		}
		//else {
		//timelineStore.createFilteredTimelineWindow(filterStore.topicsAndReplyFilter);
		//}
		//await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
	}
</script>
