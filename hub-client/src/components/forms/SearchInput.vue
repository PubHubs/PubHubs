<template>
	<!-- Desktop search component -->
	<div class="hidden items-center justify-end rounded-md bg-background md:flex" v-click-outside="reset">
		<div class="relative flex max-w-full items-center justify-end transition-all duration-200">
			<input
				class="h-full w-full flex-1 border-none bg-transparent ~text-label-small-min/label-small-max placeholder:text-on-surface-variant focus:outline-0 focus:outline-offset-0 focus:ring-0"
				type="text"
				role="searchbox"
				v-model="value"
				:placeholder="t('others.search_room')"
				:title="t('others.search_room')"
				@keydown="
					changed();
					reset();
				"
				@keydown.enter="search()"
				@keydown.esc="
					cancel();
					reset();
					toggleSearch();
				"
			/>

			<button @click="search()"><Icon type="magnifying-glass" class="rounded-md bg-background p-2 text-accent-secondary dark:text-on-surface-variant" size="sm" /></button>
		</div>
	</div>

	<!-- Mobile search component. -->
	<div class="flex w-full items-center justify-end rounded-md bg-background md:hidden">
		<div class="relative flex w-full items-center justify-end transition-all duration-200">
			<Icon v-if="!isExpanded" type="magnifying-glass" class="cursor-pointer p-2 text-accent-secondary dark:text-on-surface-variant" size="sm" @click="toggleSearch" />
			<input
				v-if="isExpanded"
				class="h-full w-full flex-1 border-none bg-transparent ~text-label-small-min/label-small-max placeholder:text-on-surface-variant focus:outline-0 focus:outline-offset-0 focus:ring-0"
				type="text"
				role="searchbox"
				v-model="value"
				ref="searchInput"
				:placeholder="$t('others.search_room')"
				:title="$t('others.search_room')"
				@keydown="
					changed();
					reset();
				"
				@keydown.enter="search()"
				@keydown.esc="
					cancel();
					reset();
					toggleSearch();
				"
			/>
			<div v-if="isExpanded">
				<button v-if="isExpanded" @click.stop="search()">
					<Icon type="magnifying-glass" class="rounded-md bg-background p-2 text-accent-secondary dark:text-on-surface-variant" size="sm" />
				</button>
				<button v-if="isExpanded" @click="toggleSearch">
					<Icon type="x" class="rounded-md bg-surface p-2 text-accent-secondary dark:text-on-surface-variant" size="sm" />
				</button>
			</div>
		</div>
	</div>

	<!-- Search results -->
	<div v-if="searched" class="absolute right-0 top-16 z-50 w-full overflow-y-auto rounded-md bg-surface-low md:top-20 md:w-[20vw]" data-testid="search-result">
		<template v-if="searchResultsToShow && searchResultsToShow.length > 0">
			<div v-for="item in searchResultsToShow" :key="item.event_id" class="group" role="listitem">
				<a href="#" @click.prevent="onScrollToEventId(item.event_id, item.event_threadId)">
					<div class="flex items-center gap-2 p-2 group-hover:bg-surface">
						<Avatar :userId="item.event_sender" class="h-8 w-8 flex-none" />
						<TruncatedText>{{ item.event_body }}</TruncatedText>
					</div>
				</a>
			</div>
		</template>
		<template v-else-if="isSearching">
			<InlineSpinner class="float-left mr-2" />
			<p role="status">{{ t('others.searching') }}</p>
		</template>
		<template v-else>
			<p role="status" v-if="value !== ''" class="p-2">
				{{ t('others.search_nothing_found') }}
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Avatar from '../ui/Avatar.vue';
	import Icon from '../elements/Icon.vue';
	import InlineSpinner from '../ui/InlineSpinner.vue';

	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { filterAlphanumeric } from '@/logic/core/extensions';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import Room from '@/model/rooms/Room';
	import { RoomEmit } from '@/model/constants';
	import { useRooms } from '@/logic/store/store';
	import { ISearchResults, SearchResult } from 'matrix-js-sdk';
	import { useI18n } from 'vue-i18n';
	import { PropType, computed, nextTick, ref, useTemplateRef } from 'vue';
	import TruncatedText from '../elements/TruncatedText.vue';
	import { TSearchParameters, TSearchResult } from '@/model/search/TSearch';
	const { t } = useI18n();
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const searchField = useTemplateRef('searchInput');

	// Passed by the parentcomponent
	const props = defineProps({
		searchParameters: {
			type: Object as PropType<TSearchParameters>,
			required: true,
		},
		room: Room,
	});

	const searchResults = ref<TSearchResult[]>([]);
	const searched = ref(false);
	const isSearching = ref(false);
	let searchResponse: ISearchResults | undefined = undefined;

	const emit = defineEmits([...usedEvents, RoomEmit.ScrollToEventId, 'toggleSearchbar']);
	const { value, changed, cancel } = useFormInputEvents(emit);

	const isExpanded = ref(false);

	function toggleSearch() {
		if (isExpanded.value) {
			isExpanded.value = false;
		} else {
			isExpanded.value = true;
			nextTick(() => {
				searchField.value?.focus();
			});
		}
		emit('toggleSearchbar', isExpanded.value);
	}

	// Searchresults shown in list. When the text 'more results' is shown the last result is omitted to keep it in view
	const searchResultsToShow = computed(() => {
		// Only results that do not have an empty event_body should be shown
		const filteredSearchResults = searchResults.value.filter((result) => result.event_body !== '');
		return filteredSearchResults; // Return all items
	});

	async function search() {
		emit('search-started');
		searchResults.value = [];
		searched.value = true;
		isSearching.value = true;
		if (!value.value) {
			isSearching.value = false;
			return;
		}

		try {
			searchResponse = await pubhubs.searchRoomEvents(value.value as string, props.searchParameters);
		} catch (err) {
			isSearching.value = false;
			console.error('An error occurred while searching the room: ', err);
		}

		if (searchResponse && searchResponse.next_batch) {
			while (searchResponse.next_batch) {
				searchResponse = await pubhubs.backPaginateRoomEventsSearch(searchResponse);
			}
		}
		if (searchResponse && searchResponse.results.length > 0) {
			searchResults.value = mapSearchResult(searchResponse.results);
		}
		isSearching.value = false;
	}

	function reset() {
		searchResults.value = [];
		searched.value = false;
	}

	async function onScrollToEventId(eventId: string, threadId: string | undefined) {
		if (props.searchParameters.roomId && rooms.currentRoom!.roomId === props.searchParameters.roomId) {
			emit(RoomEmit.ScrollToEventId, { eventId: eventId, threadId: threadId });
		}
	}

	function mapSearchResult(results: SearchResult[]): TSearchResult[] {
		if (!results || results.length == 0) {
			return [];
		}
		let mappedResults = results.map(
			(result) =>
				({
					rank: result.rank,
					event_id: result.context.ourEvent.event.event_id!,
					event_threadId: result.context.ourEvent.getThread()?.id,
					event_type: result.context.ourEvent.event.type,
					event_body: result.context.ourEvent.event.content?.body,
					event_sender: result.context.ourEvent.event.sender,
				}) as TSearchResult,
		);
		mappedResults.forEach((element) => {
			element.event_body = formatSearchResult(element.event_body, value.value as string, 5);
		});
		return mappedResults;
	}

	function formatSearchResult(eventbody: string, searchterm: string, numberOfWords: number): string {
		if (!eventbody || !searchterm) return '';

		var words = filterAlphanumeric(eventbody)?.toLowerCase().split(/\s+/);
		var searchWords = filterAlphanumeric(searchterm.trim())?.toLowerCase().split(/\s+/);

		if (!words || !searchWords) return '';

		// Compare the words to the searchterm.
		// if searchterm is fully found, index will be > -1
		// if searchterm is not found, index will be -1
		var index = -1;
		for (var i = 0; i < words.length; i++) {
			if (words[i] === searchWords[0]) {
				index = i;
				for (var j = 1; j < searchWords.length; j++) {
					// If the words do not match, reset the index to -1 and break out of the loop
					if (words[i + j] !== searchWords[j]) {
						index = -1;
						break;
					}
				}
				// If the index is not -1 after the loop, the search term was found
				if (index !== -1) {
					break;
				}
			}
		}

		if (index === -1) {
			return '';
		}

		var start = Math.max(0, index - numberOfWords);
		var end = Math.min(eventbody.split(' ').length, index + searchWords.length + numberOfWords);

		return eventbody.split(' ').slice(start, end).join(' ');
	}
</script>
