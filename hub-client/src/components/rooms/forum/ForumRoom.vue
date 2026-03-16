<template>
	<div class="mx-auto w-full pr-3 pl-3 md:w-2/3">
		<SubheaderForum />
		<template v-if="forumTopics.length > 0">
			<div class="flex flex-col gap-y-2">
				<div v-for="topic in getTopics()" :key="topic.eventId">
					<ul id="topic.eventId">
						<ThreadItem @click="$router.push({ name: 'topic', params: { key: topic.eventId } })" :topic="topic" />
					</ul>
				</div>
			</div>
		</template>
	</div>
	<InlineSpinner v-if="isAwaitingFetch"></InlineSpinner>
</template>

<script setup lang="ts">
	// Packages
	import { TimelineWindow } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';

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
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();
	const timelineStore = useTimelineStore();
	const forumStore = useForumStore();
	const sortingStore = useSortingStore();
	const filterStore = useFilterStore();
	const sort = useSortingStore();

	const sortingOption = computed(() => sortingStore.key);
	const sortingDirection = computed(() => sortingStore.direction);
	const isAwaitingFetch = ref(false);

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

	const forumTopics = computed(() => forumStore.forumTopics);
</script>
