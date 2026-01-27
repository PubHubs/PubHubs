<template>
	<div class="flex h-full flex-col p-3">
		<!-- Search input -->
		<div class="bg-surface-high flex items-center gap-2 rounded-md px-3 py-2">
			<Icon type="magnifying-glass" size="sm" class="text-on-surface-dim" />
			<input
				ref="searchInput"
				v-model="searchTerm"
				type="text"
				role="searchbox"
				class="text-label-small placeholder:text-on-surface-variant w-full border-none bg-transparent focus:ring-0 focus:outline-0"
				:placeholder="t('others.search_room')"
				@keydown.enter="search()"
			/>
			<button v-if="searchTerm" @click="clearSearch()" class="text-on-surface-dim hover:text-on-surface">
				<Icon type="x" size="sm" />
			</button>
		</div>

		<!-- Search results -->
		<div class="mt-4 h-full flex-1 overflow-y-auto">
			<template v-if="isSearching">
				<div class="flex items-center gap-2 p-2">
					<InlineSpinner />
					<p role="status">{{ t('others.searching') }}</p>
				</div>
			</template>
			<template v-else-if="searched && searchResults.length === 0">
				<p role="status" class="text-on-surface-dim p-2">
					{{ t('others.search_nothing_found') }}
				</p>
			</template>
			<template v-else-if="searchResults.length > 0">
				<div v-for="item in searchResults" :key="item.event_id" class="group" role="listitem">
					<a href="#" @click.prevent="onScrollToEventId(item.event_id, item.event_threadId)">
						<div class="hover:bg-surface-high flex flex-col gap-1 rounded-md p-2">
							<div class="flex items-center gap-2">
								<Avatar :avatar-url="user.userAvatar(item.event_sender)" :user-id="item.event_sender" class="h-8 w-8 shrink-0" />
								<div class="min-w-0 flex-1">
									<TruncatedText>{{ item.event_body }}</TruncatedText>
								</div>
							</div>
							<div class="text-on-surface-dim pl-10">
								<EventTimeCompact :timestamp="item.event_timestamp" />
							</div>
						</div>
					</a>
				</div>
			</template>
			<template v-else>
				<p class="text-on-surface-dim p-2">{{ t('others.search_room_hint') }}</p>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ISearchResults, SearchResult } from 'matrix-js-sdk';
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import EventTimeCompact from '@hub-client/components/rooms/EventTimeCompact.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	import { useMentions } from '@hub-client/composables/useMentions';

	// Logic
	import { filterAlphanumeric } from '@hub-client/logic/core/extensions';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { TSearchResult } from '@hub-client/models/search/TSearch';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const user = useUser();

	const props = defineProps<{
		room: Room;
	}>();

	const emit = defineEmits<{
		(e: 'scrollToEventId', payload: { eventId: string; threadId?: string }): void;
	}>();

	const searchInput = ref<HTMLInputElement | null>(null);
	const searchTerm = ref('');
	const searchResults = ref<TSearchResult[]>([]);
	const searched = ref(false);
	const isSearching = ref(false);

	onMounted(() => {
		searchInput.value?.focus();
	});

	async function search() {
		if (!searchTerm.value.trim()) return;

		searchResults.value = [];
		searched.value = true;
		isSearching.value = true;

		try {
			let searchResponse = await pubhubs.searchRoomEvents(searchTerm.value, {
				roomId: props.room.roomId,
				term: searchTerm.value,
			});

			if (searchResponse && searchResponse.next_batch) {
				while (searchResponse.next_batch) {
					searchResponse = await pubhubs.backPaginateRoomEventsSearch(searchResponse);
				}
			}

			if (searchResponse && searchResponse.results.length > 0) {
				searchResults.value = mapSearchResult(searchResponse.results);
			}
		} catch (err) {
			console.error('An error occurred while searching the room: ', err);
		}

		isSearching.value = false;
	}

	function clearSearch() {
		searchTerm.value = '';
		searchResults.value = [];
		searched.value = false;
		searchInput.value?.focus();
	}

	function onScrollToEventId(eventId: string, threadId: string | undefined) {
		emit('scrollToEventId', { eventId, threadId });
	}

	function mapSearchResult(results: SearchResult[]): TSearchResult[] {
		if (!results || results.length === 0) {
			return [];
		}

		const mappedResults = results.map(
			(result) =>
				({
					rank: result.rank,
					event_id: result.context.ourEvent.event.event_id!,
					event_threadId: result.context.ourEvent.getThread()?.id,
					event_type: result.context.ourEvent.event.type,
					event_body: result.context.ourEvent.event.content?.body,
					event_sender: result.context.ourEvent.event.sender,
					event_timestamp: result.context.ourEvent.event.origin_server_ts ?? 0,
				}) as TSearchResult,
		);

		mappedResults.forEach((element) => {
			element.event_body = formatSearchResult(element.event_body, searchTerm.value, 5);
		});

		// Sort by timestamp ascending (oldest first, matching timeline direction)
		mappedResults.sort((a, b) => a.event_timestamp - b.event_timestamp);

		return mappedResults;
	}

	function formatSearchResult(eventbody: string, searchterm: string, numberOfWords: number): string {
		if (!eventbody || !searchterm) return '';

		const words = filterAlphanumeric(eventbody)?.toLowerCase().split(/\s+/);
		const searchWords = filterAlphanumeric(searchterm.trim())?.toLowerCase().split(/\s+/);

		if (!words || !searchWords) return '';

		let index = -1;
		for (let i = 0; i <= words.length - searchWords.length; i++) {
			if (words[i] !== searchWords[0]) continue;
			let match = true;
			for (let j = 1; j < searchWords.length; j++) {
				if (words[i + j] !== searchWords[j]) {
					match = false;
					break;
				}
			}
			if (match) {
				index = i;
				break;
			}
		}

		if (index === -1) return '';

		const originalWords = eventbody.split(' ');
		const start = Math.max(0, index - numberOfWords);
		const end = Math.min(originalWords.length, index + searchWords.length + numberOfWords);

		const searchSnippet = originalWords.slice(start, end).join(' ');

		return useMentions().formatMentions(searchSnippet);
	}
</script>
