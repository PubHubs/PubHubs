<template>
	<div class="hidden md:flex items-center relative" v-click-outside="reset">
		<input
			class="w-full md:pr-8 py-1 border-none rounded-md bg-gray-lighter placeholder:text-black dark:bg-gray-darker dark:text-white dark:placeholder:text-gray-light focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
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
		<Icon class="-ml-6 search-icon dark:text-gray-light -scale-100 -rotate-90" type="search" size="sm" @click="submit()"></Icon>
		<div v-if="searched" class="absolute w-full bg-gray-lighter dark:bg-gray-darker top-full rounded-md overflow-hidden">
			<template v-if="searchResults && searchResults.length > 0">
				<div v-for="item in searchResults" :key="item.event_id" class="group">
					<a href="#" @click.prevent="onScrollToEventId(item.event_id)">
						<div class="flex gap-2 group-hover:bg-gray-light group-hover:dark:bg-gray p-2">
							<Avatar :userId="item.event_sender" :icon="true" class="flex-none h-6 w-6"></Avatar>
							<TruncatedText>{{ item.event_body }}</TruncatedText>
						</div>
					</a>
				</div>
			</template>
			<template v-else>
				<p v-if="value !== ''" class="p-2">{{ $t('others.search_nothing_found') }}</p>
			</template>
		</div>
	</div>

	<!-- Mobile version of the input field will be shwon instead of the above one on smaller screens. -->
	<div class="md:hidden h-full w-full flex justify-end items-end absolute pr-2 bottom-2">
		<div class="flex gap-4 w-[35px] rounded-md focus-within:w-full focus-within:bg-hub-background-4 focus-within:dark:bg-hub-background-3 transition-all duration-200 justify-end relative items-center max-w-full overflow-hidden">
			<input
				class="h-10 flex-1 w-full placeholder:text-black dark:text-white dark:placeholder:text-gray-light bg-transparent border-none focus:outline-0 focus:outline-offset-0 focus:ring-0"
				type="text"
				v-model="value"
				:placeholder="$t('others.search')"
				:title="$t('others.search')"
				@keydown="changed()"
				@keydown.enter="submit()"
				@keydown.esc="cancel()"
			/>
			<button class="dark:text-gray-lighter px-1 rounded-full bg-hub-background-4 dark:bg-gray-darker flex justify-center items-center aspect-[1]">
				<Icon class="search-icon -scale-100 -rotate-90 px-1" type="search" size="md"></Icon>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { TSearchParameters, TSearchResult } from '@/model/model';
	import { PropType, ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms } from '@/store/store';
	import { filterAlphanumeric } from '@/core/extensions';
	import TruncatedText from '../elements/TruncatedText.vue';

	const pubhubs = usePubHubs();
	const rooms = useRooms();

	//Passed by the parentcomponent
	const props = defineProps({
		searchParameters: { type: Object as PropType<TSearchParameters>, required: true },
	});

	const searchResults = ref<TSearchResult[]>([]);
	const searched = ref(false);

	const emit = defineEmits([...usedEvents, 'scrollToEventId']);
	const { value, changed, submit, cancel } = useFormInputEvents(emit);

	async function search() {
		searchResults.value = [];
		searched.value = true;
		if (!value.value) return;
		searchResults.value = await pubhubs.searchRoomEvents(value.value as string, props.searchParameters);
		searchResults.value.forEach((element) => {
			element.event_body = formatSearchResult(element.event_body, value.value as string, 5);
		});
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

	function formatSearchResult(eventbody: string, searchterm: string, numberOfWords: number): string {
		if (!eventbody || !searchterm) return '';

		var words = filterAlphanumeric(eventbody)?.toLowerCase().split(' ');
		var searchWords = filterAlphanumeric(searchterm.trim())?.toLowerCase().split(' ');

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
		var end = Math.min(words.length, index + searchWords.length + numberOfWords);

		return eventbody.split(' ').slice(start, end).join(' ');
	}
</script>
