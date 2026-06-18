<template>
	<div class="flex h-full flex-col py-200">
		<SidebarHeader :title="t('others.search')" />
		<!-- Search input -->
		<div class="px-200">
			<div class="bg-surface-sunken flex items-center gap-100 rounded-md px-150 py-100">
				<Icon
					class="text-on-surface-dim"
					size="sm"
					type="magnifying-glass"
				/>
				<input
					ref="searchInput"
					v-model="searchTerm"
					class="text-label-small placeholder:text-on-surface-dim w-full border-none bg-transparent focus:ring-0 focus:outline-0"
					:placeholder="t('others.search_room')"
					role="searchbox"
					type="text"
					@keydown.enter="search()"
				/>
				<button
					v-if="searchTerm"
					class="text-on-surface-dim hover:text-on-surface"
					@click="clearSearch()"
				>
					<Icon
						size="sm"
						type="x"
					/>
				</button>
			</div>
		</div>

		<!-- Search results -->
		<div
			class="mt-200 h-full flex-1 overflow-y-auto px-200"
			data-testid="search-result"
		>
			<template v-if="isSearching">
				<div class="flex items-center gap-100 p-100">
					<InlineSpinner />
					<p role="status">
						{{ t('others.searching') }}
					</p>
				</div>
			</template>
			<template v-else-if="searched && searchResults.length === 0">
				<p
					class="text-on-surface-dim p-100"
					role="status"
				>
					{{ t('others.search_nothing_found') }}
				</p>
			</template>
			<template v-else-if="searchResults.length > 0">
				<div
					v-for="item in searchResults"
					:key="item.event_id"
					class="group"
					role="listitem"
				>
					<a
						href="#"
						@click.prevent="onScrollToEventId(item.event_id, item.event_threadId)"
					>
						<div class="hover:bg-surface-base rounded-base flex flex-col p-200">
							<div class="flex gap-200">
								<Avatar
									:avatar-url="user.userAvatar(item.event_sender)"
									class="h-600 w-600 shrink-0"
									:user-id="item.event_sender"
								/>
								<div class="flex flex-col gap-100">
									<div class="h-fit min-w-0 flex-1">
										<UserDisplayName
											:user-id="item.event_sender"
											:user-display-name="user.userDisplayName(item.event_sender)"
										/>
									</div>
									<div class="flex gap-200">
										<div class="min-w-0 flex-1">
											<span
												class="block w-full truncate text-sm"
												:title="item.event_body"
												>{{ item.event_body }}
											</span>
										</div>
									</div>
									<div class="flex gap-200">
										<div class="text-on-surface-dim min-w-0 flex-1">
											<span class="text-label-tiny text-on-surface-dim gap-050 inline-flex items-center">
												<EventTime
													:timestamp="item.event_timestamp"
													:show-date="true"
												/>
												<EventTime
													:timestamp="item.event_timestamp"
													:show-date="false"
												/>
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</a>
				</div>
			</template>
			<template v-else>
				<p class="text-on-surface-dim p-100">
					{{ t('others.search_room_hint') }}
				</p>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type SearchResult } from 'matrix-js-sdk';
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import type Room from '@hub-client/models/rooms/Room';
	import { type TSearchResult } from '@hub-client/models/search/TSearch';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
	}>();
	const emit = defineEmits<{
		(e: 'scrollToEventId', payload: { eventId: string; threadId?: string }): void;
	}>();
	const logger = createLogger('RoomSearch');
	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const _rooms = useRooms();
	const settings = useSettings();
	const sidebar = useSidebar();
	const user = useUser();

	const searchInput = ref<HTMLInputElement | null>(null);
	const { searchTerm, searchResults, searched, isSearching } = useSidebar();

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
			logger.error('An error occurred while searching the room: ', err);
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
		// Close sidebar on mobile after clicking a search result
		if (settings.isMobileState) {
			sidebar.close();
		}
	}

	function mapSearchResult(results: SearchResult[]): TSearchResult[] {
		if (!results || results.length === 0) {
			return [];
		}

		const mappedResults = results.map(
			(result) =>
				({
					rank: result.rank,
					event_id: result.context.ourEvent.event.event_id ?? '',
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

		const trimmed = eventbody.trim();
		const lowerBody = trimmed.toLowerCase();
		const lowerSearch = searchterm.trim().toLowerCase();
		const searchWords = lowerSearch.split(/\s+/).filter(Boolean);
		if (searchWords.length === 0) return '';

		const originalWords = trimmed.split(/\s+/);
		const lowerWords = lowerBody.split(/\s+/);

		let matchIndex = -1;
		for (let i = 0; i <= lowerWords.length - searchWords.length; i++) {
			if (lowerWords[i] !== searchWords[0]) continue;
			let allMatch = true;
			for (let j = 1; j < searchWords.length; j++) {
				if (lowerWords[i + j] !== searchWords[j]) {
					allMatch = false;
					break;
				}
			}
			if (allMatch) {
				matchIndex = i;
				break;
			}
		}

		if (matchIndex === -1) return '';

		const start = Math.max(0, matchIndex - numberOfWords);
		const end = Math.min(originalWords.length, matchIndex + searchWords.length + numberOfWords);
		const snippet = originalWords.slice(start, end).join(' ');

		return useMentionsDisplay().formatMentions(snippet);
	}
</script>
