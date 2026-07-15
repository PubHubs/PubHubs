<template>
	<div class="relative flex h-full flex-col overflow-hidden">
		<div
			ref="elScrollContainer"
			class="h-full w-full overflow-x-hidden overflow-y-auto p-200"
		>
			<div class="flex w-full flex-col">
				<ForumThreadDialog
					:id="room.roomId"
					:open="addNewPost"
					@update:open="addNewPost = $event"
				/>

				<!-- Search + sort bar always visible; feed appears once data arrives -->
				<FilterableList
					class="w-full pb-1000"
					:items="feedItems"
					:filter-keys="['title', 'description', 'author']"
					:placeholder="$t('others.search')"
					:empty-text="room.timelineReady ? $t('message.forum.no_threads') : ''"
				>
					<template #actions>
						<!-- Sort mode -->
						<div class="flex flex-wrap items-center gap-100">
							<Button
								v-for="mode in FeedSort"
								:key="mode"
								size="sm"
								:variant="mode === sortMode ? 'primary' : 'secondary'"
								:aria-pressed="mode === sortMode"
								@click="sortMode = mode"
								>{{ $t('message.forum.sort_' + mode) }}</Button
							>
						</div>
					</template>
					<template #filtered="{ items }">
						<ul
							v-if="items.length > 0"
							class="flex flex-col gap-y-200"
							:class="isMobile ? 'px-150' : 'px-200'"
							data-testid="forum-thread-list"
						>
							<li
								v-for="item in items"
								:key="item.eventId as string"
								:data-thread-id="item.eventId"
							>
								<ForumPostCard
									:event="item.event as TimelineEvent"
									:room="room"
								></ForumPostCard>
							</li>
						</ul>
					</template>
				</FilterableList>

				<!-- Spinner during initial load -->
				<div
					v-if="events.length === 0 && !room.timelineReady"
					class="flex min-h-300 items-center justify-center py-400"
					role="status"
					:aria-label="$t('common.loading')"
				>
					<InlineSpinner class="mx-auto" />
				</div>
			</div>
		</div>

		<FloatingActionButton
			class="absolute right-300 bottom-300"
			icon="plus"
			:label="$t('message.forum.add_new_thread')"
			@click="addNewPost = true"
		/>
	</div>
</template>

<script lang="ts">
	const MAX_SCROLL_POSITIONS = 30;
	// Remembers the feed scroll position per room, so returning from a post restores the reading position.
	const feedScrollPositions = new Map<string, number>();
</script>

<script setup lang="ts">
	// Packages
	import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import ForumPostCard from '@hub-client/components/rooms/forum/ForumPostCard.vue';
	import ForumThreadDialog from '@hub-client/components/rooms/forum/ForumThreadDialog.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import { getVoteScore } from '@hub-client/logic/forum/votes';

	// Models
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
	}>();

	enum FeedSort {
		Trending = 'trending',
		Newest = 'newest',
		Top = 'top',
	}

	const rooms = useRooms();
	const settings = useSettings();
	const user = useUser();

	const isMobile = computed(() => settings.isMobileState);

	const elScrollContainer = ref<HTMLElement | null>(null);
	const addNewPost = ref(false);
	const sortMode = ref(FeedSort.Trending);

	const events = computed(() => {
		return props.room.getTimeline().filter((event) => !event.isDeleted && !event.matrixEvent.isRedacted());
	});

	const replyCount = (event: TimelineEvent): number => {
		return rooms.threadLengths[props.room.roomId]?.[event.matrixEvent.getId()!] ?? 0;
	};

	// Most recent activity first: a new comment bumps the post
	const byActivity = (a: TimelineEvent, b: TimelineEvent): number => {
		return b.latestThreadEventTimestamp - a.latestThreadEventTimestamp;
	};

	// Most recently created post first
	const byCreated = (a: TimelineEvent, b: TimelineEvent): number => {
		return b.matrixEvent.getTs() - a.matrixEvent.getTs();
	};

	/**
	 * The ordered feed.
	 * - Trending (default): posts bucketed per day of last activity (newest day first),
	 *   ordered by popularity within each day.
	 * - Newest: purely by post creation date.
	 * - Top: purely popularity-based.
	 */
	const orderedEvents = computed<TimelineEvent[]>(() => {
		// Thread activity (latestThreadEventTimestamp) is not reactive itself; depend on the
		// room's threadLengths so the feed re-sorts when thread info loads or a comment arrives.
		void Object.values(rooms.threadLengths[props.room.roomId] ?? {});
		const list = [...events.value];

		// Compute vote scores once per event
		const scores = new Map<string, number>();
		for (const event of list) {
			scores.set(event.matrixEvent.getId()!, getVoteScore(props.room, event.matrixEvent.getId()!));
		}
		const byVoteScore = (a: TimelineEvent, b: TimelineEvent) => (scores.get(b.matrixEvent.getId()!) ?? 0) - (scores.get(a.matrixEvent.getId()!) ?? 0);

		const byPopularity = (a: TimelineEvent, b: TimelineEvent) => byVoteScore(a, b) || replyCount(b) - replyCount(a) || byActivity(a, b);

		if (sortMode.value === FeedSort.Newest) {
			return list.sort(byCreated);
		}
		if (sortMode.value === FeedSort.Top) {
			return list.sort(byPopularity);
		}

		// Trending: bucket per calendar day of last activity, newest day first
		list.sort(byActivity);
		const buckets = new Map<string, TimelineEvent[]>();
		for (const event of list) {
			const day = new Date(event.latestThreadEventTimestamp).toDateString();
			const bucket = buckets.get(day);
			if (bucket) {
				bucket.push(event);
			} else {
				buckets.set(day, [event]);
			}
		}
		return [...buckets.values()].flatMap((bucketEvents) => bucketEvents.sort(byPopularity));
	});

	// The ordered feed as searchable records for FilterableList
	const feedItems = computed(() => {
		return orderedEvents.value.map((event) => {
			const content = event.matrixEvent.event.content;
			return {
				event,
				eventId: event.matrixEvent.getId()!,
				title: content?.body ?? '',
				description: content?.ph_topic_body ?? content?.description ?? '',
				author: user.userDisplayName(event.matrixEvent.getSender()!) ?? '',
			};
		});
	});

	onMounted(async () => {
		const savedScrollTop = feedScrollPositions.get(props.room.roomId);
		if (savedScrollTop) {
			await nextTick();
			if (elScrollContainer.value) {
				elScrollContainer.value.scrollTop = savedScrollTop;
			}
		}
	});

	onBeforeUnmount(() => {
		if (elScrollContainer.value) {
			feedScrollPositions.set(props.room.roomId, elScrollContainer.value.scrollTop);
			if (feedScrollPositions.size > MAX_SCROLL_POSITIONS) {
				const oldestKey = feedScrollPositions.keys().next().value;
				if (oldestKey !== undefined) {
					feedScrollPositions.delete(oldestKey);
				}
			}
		}
	});
</script>
