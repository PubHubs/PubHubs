<template>
	<article
		class="bg-surface-base border-surface-elevated hover:bg-surface-elevated focus-visible:outline-accent-primary rounded-base flex cursor-pointer flex-col gap-100 border-3 transition-colors duration-150 focus-visible:outline-3"
		:class="isMobile ? 'p-200' : 'p-300'"
		data-testid="forum-post-card"
		role="button"
		tabindex="0"
		@click="openPost()"
		@keydown.enter.self.prevent="openPost()"
		@keydown.space.self.prevent="openPost()"
	>
		<H3 class="text-on-surface font-headings line-clamp-2 font-semibold break-words">{{ title }}</H3>

		<p
			v-if="description"
			class="text-on-surface-dim line-clamp-2 break-words"
		>
			{{ description }}
		</p>

		<div class="gap-y-050 flex flex-wrap items-center gap-x-200">
			<div class="flex min-w-0 items-center gap-100">
				<Avatar
					:avatar-url="user.userAvatar(sender)"
					:user-id="sender"
					:room-id="room.roomId"
				/>
				<UserDisplayName
					:user-id="sender"
					:user-display-name="user.userDisplayName(sender)"
					:room-id="room.roomId"
				/>
				<span class="text-label-tiny text-on-surface-dim gap-050 inline-flex items-center">
					<EventTime
						:timestamp="createdTimestamp"
						:show-date="true"
					/>
				</span>
			</div>

			<div class="text-on-surface-dim gap-y-050 ml-auto flex flex-wrap items-center gap-x-100">
				<ForumVote
					:room="room"
					:event-id="event.matrixEvent.getId()!"
				/>
				<span class="gap-050 inline-flex items-center">
					<Icon
						type="chat-circle-text"
						size="sm"
					/>
					<span class="text-label-small">{{ nrOfComments }}</span>
				</span>
				<span
					v-if="lastActivityTimestamp > createdTimestamp"
					class="text-label-tiny gap-050 inline-flex items-center"
				>
					<EventTime
						:timestamp="lastActivityTimestamp"
						:show-date="true"
					/>
				</span>
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import ForumVote from '@hub-client/components/rooms/forum/ForumVote.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		event: TimelineEvent;
		room: Room;
	}>();

	const router = useRouter();
	const rooms = useRooms();
	const settings = useSettings();
	const user = useUser();

	const isMobile = computed(() => settings.isMobileState);

	function openPost() {
		router.push({ name: 'room', params: { id: props.room.roomId, topicId: props.event.matrixEvent.event.event_id } });
	}

	const sender = computed(() => props.event.matrixEvent.getSender()!);
	const title = computed(() => props.event.matrixEvent.event.content?.body ?? '');
	const createdTimestamp = computed(() => props.event.matrixEvent.getTs());

	const lastActivityTimestamp = computed(() => {
		// Not reactive by itself; depend on threadLengths so the card updates when a comment arrives
		void rooms.threadLengths[props.room.roomId]?.[props.event.matrixEvent.getId()!];
		return props.event.latestThreadEventTimestamp;
	});

	const description = computed(() => {
		const content = props.event.matrixEvent.event.content;
		return content?.ph_topic_body ?? content?.description ?? '';
	});

	const nrOfComments = computed(() => {
		return rooms.threadLengths[props.room.roomId]?.[props.event.matrixEvent.getId()!] ?? 0;
	});
</script>
