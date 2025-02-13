<template>
	<!-- Desktop search component -->
	<div class="hidden md:flex items-center relative" v-click-outside="reset">
		<input
			class="w-full min-w-48 md:pr-8 py-1 border-none rounded-md bg-gray-lighter placeholder:text-black dark:bg-gray-darker dark:text-white dark:placeholder:text-gray-light focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
			type="text"
			v-model="value"
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
			"
		/>
		<span class="cursor-pointer">
			<Icon class="-ml-6 search-icon dark:text-gray-light" type="search" size="sm" @click="search()"></Icon>
		</span>
	</div>

	<!-- Mobile search component. -->
	<div class="md:hidden h-full w-full flex justify-end items-center absolute pr-2">
		<div class="flex gap-4 w-[35px] rounded-md focus-within:w-full focus-within:bg-hub-background-4 focus-within:dark:bg-hub-background-3 transition-all duration-200 justify-end relative items-center max-w-full">
			<input
				class="h-10 flex-1 w-full placeholder:text-black dark:text-white dark:placeholder:text-gray-light bg-transparent border-none focus:outline-0 focus:outline-offset-0 focus:ring-0"
				type="text"
				v-model="value"
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
				"
			/>
			<button class="px-1 rounded-md flex justify-center items-center cursor-pointer" @click.stop="search()">
				<Icon class="search-icon px-1" type="search" size="md"></Icon>
			</button>
		</div>
	</div>

	<!-- Search results -->
	<div v-if="searched" class="absolute right-2 md:right-0 top-16 md:top-20 w-full max-w-80 bg-gray-lighter dark:bg-gray-darker rounded-b-md max-h-[500%] overflow-y-auto scrollbar">
		<template v-if="searchResultsToShow && searchResultsToShow.length > 0">
			<div v-for="item in searchResultsToShow" :key="item.event_id" class="group">
				<a href="#" @click.prevent="onScrollToEventId(item.event_id)">
					<div class="flex gap-2 group-hover:bg-gray-light group-hover:dark:bg-gray p-2">
						<Avatar :user="room?.getMember(item.event_sender, true)" class="flex-none h-6 w-6"></Avatar>
						<TruncatedText>{{ item.event_body }}</TruncatedText>
					</div>
				</a>
			</div>
		</template>
		<template v-else-if="isSearching">
			<InlineSpinner class="float-left mr-2"></InlineSpinner>
			<p>{{ $t('others.searching') }}</p>
		</template>
		<template v-else>
			<p v-if="value !== ''" class="p-2">{{ $t('others.search_nothing_found') }}</p>
		</template>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Avatar from '../ui/Avatar.vue';
	import Icon from '../elements/Icon.vue';
	import InlineSpinner from '../ui/InlineSpinner.vue';

	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { filterAlphanumeric } from '@/core/extensions';
	import { usePubHubs } from '@/core/pubhubsStore';
	import Room from '@/model/rooms/Room';
	import { useRooms } from '@/store/store';
	import { ISearchResults, SearchResult } from 'matrix-js-sdk';
	import { PropType, computed, ref } from 'vue';
	import TruncatedText from '../elements/TruncatedText.vue';
	import { TSearchParameters, TSearchResult } from '@/model/search/TSearch';

	const pubhubs = usePubHubs();
	const rooms = useRooms();

	//Passed by the parentcomponent
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

	const emit = defineEmits([...usedEvents, 'scrollToEventId']);
	const { value, changed, cancel } = useFormInputEvents(emit);

	// searchresults shown in list. When the text 'more results' is shown the last result is omitted to keep it in view
	const searchResultsToShow = computed(() => {
		// Only results that do not have an empty event_body should be shown
		const filteredSearchResults = searchResults.value.filter((result) => result.event_body !== '');
		return filteredSearchResults; // Return all items
	});

	async function search() {
		searchResults.value = [];
		searched.value = true;
		isSearching.value = true;
		if (!value.value) return;

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

	async function onScrollToEventId(eventId: string) {
		if (props.searchParameters.roomId && rooms.currentRoom!.roomId === props.searchParameters.roomId) {
			emit('scrollToEventId', { eventId: eventId });
			// reset();
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
