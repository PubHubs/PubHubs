<template>
	<div class="bg-surface hover:dark:bg-surface-high mx-auto flex cursor-pointer flex-row gap-4 rounded-xl p-3">
		<div class="relative flex flex-col justify-center">
			<AvatarId v-if="roomMember" :userId="roomMember.userId" />
			<Icon v-if="topic.closed" class="absolute -top-1 -right-1" type="lock" />
		</div>
		<div class="flex w-full flex-col gap-1">
			<div class="flex w-full flex-row">
				<div class="flex w-full items-center">
					<UserDisplayName :user-id="topic.author.userId" :user-display-name="topic.author.displayName"></UserDisplayName>
				</div>
				<div class="flex flex-row items-end">
					<EventTime :timestamp="topic.timestamp" :showDate="true"></EventTime>
				</div>
			</div>

			<div class="flex items-center">
				<div class="line-clamp-2 grow wrap-break-word">{{ topic.title }}</div>
				<div class="flex items-center justify-between gap-2">
					<div></div>
					<!-- <div class="flex flex-row items-center">
						<Icon type="thumbs-up" />
						<span class="ml-1 text-2xl">{{ topic.likes }}</span>
					</div> -->
					<!-- <div class="flex flex-row items-center">
						<Icon type="thumbs-down" />
						<span class="ml-1 text-2xl">{{ topic.dislikes }}</span>
					</div> -->
					<div class="flex flex-row items-center gap-1">
						<Icon type="chat-circle-text" />
						<span>{{ totalReplies }}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import AvatarId from '@hub-client/components/ui/AvatarId.vue';

	import { TThread } from '@hub-client/models/events/types';

	import { useRooms } from '@hub-client/stores/rooms';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const { topic } = defineProps<{ topic: TThread }>();

	const room = useRooms().currentRoom;
	const roomMember = computed(() => {
		if (room && topic.author?.userId) {
			return room.getMember(topic.author?.userId!, true);
		}
		return null;
	});

	function getReplyCount(topic: TThread) {
		let replyCount = topic.replies.length;
		for (const reply of topic.replies) {
			replyCount += reply.replies.length;
		}
		return replyCount;
	}

	const totalReplies = computed(() => {
		return getReplyCount(topic);
	});
</script>
