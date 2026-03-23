<template>
	<div v-if="!topicId" class="mx-auto w-full pr-3 pl-3 md:w-2/3">
		<SubheaderForum />
		<template v-if="forumStore.forumTopics.length > 0">
			<ul class="flex flex-col gap-y-2">
				<li v-for="topic in getTopics()" :key="topic.eventId">
					<ThreadItem @click="$router.push({ name: 'room', params: { id: roomId, topicId: topic.eventId } })" :topic="topic" />
				</li>
			</ul>
		</template>
	</div>

	<ForumTopic v-if="topicId"></ForumTopic>

	<InlineSpinner v-if="isAwaitingFetch"></InlineSpinner>
</template>

<script setup lang="ts">
	// Packages
	import { TimelineWindow } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';

	import ForumTopic from '@hub-client/components/rooms/forum/ForumTopic.vue';
	// Components
	import SubheaderForum from '@hub-client/components/rooms/forum/SubheaderForum.vue';
	import ThreadItem from '@hub-client/components/rooms/forum/ThreadItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	// Logic

	// Models

	// Stores
	import { FILTER_STATE, useFilterStore } from '@hub-client/stores/forum/filterStore';
	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { SortDirection, sortOptions, useSortingStore } from '@hub-client/stores/forum/sortingStore';
	import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

	const timelineStore = useTimelineStore();
	const forumStore = useForumStore();
	const sortingStore = useSortingStore();
	const filterStore = useFilterStore();
	const sort = useSortingStore();

	const sortingOption = computed(() => sortingStore.key);
	const sortingDirection = computed(() => sortingStore.direction);
	const isAwaitingFetch = ref(false);

	const props = defineProps({
		roomId: {
			type: String,
			required: true,
		},
		topicId: {
			type: String,
		},
	});

	onMounted(async () => {
		filterStore.filter = FILTER_STATE.NO;
		isAwaitingFetch.value = true;
		try {
			timelineStore.initRoom();
			timelineStore.createFilteredTimelineWindow(filterStore.topicsAndReplyFilter);
			await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		} catch (error) {
			console.error('Error while setting up timeline and fetching topics: ', error);
		} finally {
			isAwaitingFetch.value = false;
		}
	});

	watch([() => sortingOption, sortingDirection], async () => {
		const sortOption = sortOptions.find((option) => option.key === sort.key);
		if (sortOption) {
			forumStore.forumTopics.sort(sortOption.sortFn);
			if (sort.direction === SortDirection.DESC) {
				forumStore.forumTopics.reverse();
			}
		}
	});

	function getTopics() {
		if (filterStore.filter === FILTER_STATE.MY_TOPICS) {
			return forumStore.myTopics;
		}
		return forumStore.forumTopics;
	}
</script>
