<template>
	<div class="bg-surface hover:dark:bg-surface-high mx-auto flex cursor-pointer flex-row gap-x-4 rounded-xl p-3">
		<div class="flex flex-col justify-center">
			<AvatarId v-if="roomMember" :userId="roomMember.userId" />
			<Icon v-if="topic.closed" class="self-center pt-2" type="locked" />
		</div>
		<div class="flex w-full flex-col overflow-hidden">
			<span class="line-clamp-2 break-words">{{ topic.title }}</span>
			<div class="flex w-full flex-row">
				<div class="mt-1 flex w-full items-center text-2xl">
					<UserDisplayName :user-id="topic.author.userId" :user-display-name="topic.author.displayName"></UserDisplayName>
				</div>
				<div class="flex flex-row items-end">
					<EventTime :timestamp="topic.timestamp" :showDate="true"></EventTime>
				</div>
			</div>
			<div class="mt-1 flex w-full flex-row gap-x-4">
				<div class="flex flex-row items-center">
					<Icon type="thumbs-up" />
					<span class="ml-1 text-2xl">{{ topic.likes }}</span>
				</div>
				<div class="flex flex-row items-center">
					<Icon type="thumbs-down" />
					<span class="ml-1 text-2xl">{{ topic.dislikes }}</span>
				</div>
				<div class="flex flex-row items-center">
					<Icon type="chat-circle-text" />
					<span class="ml-1 text-2xl">{{ totalReplies }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import AvatarId from '@hub-client/components/ui/AvatarId.vue';

	import { TThread } from '@hub-client/models/events/types';

	import { useRooms } from '@hub-client/stores/rooms';

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
