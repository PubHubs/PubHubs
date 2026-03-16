<template>
	<li class="bg-surface hover:dark:bg-surface-high mx-auto flex cursor-pointer flex-row gap-x-4 rounded-xl p-3">
		<div class="flex flex-col justify-center">
			<Avatar v-if="roomMember" :user="roomMember" />
			<Icon v-if="topic.closed" class="self-center pt-2" type="locked" size="sm" />
		</div>
		<div class="flex w-full flex-col overflow-hidden">
			<span class="line-clamp-2 break-words">{{ topic.title }}</span>
			<div class="flex w-full flex-row">
				<div class="mt-1 flex w-full items-center text-2xl">
					<span class="inline-block">
						<span class="pr-1 font-bold">{{ formattedDisplayName }}</span>
						<span>{{ formattedUserId }}</span>
					</span>
				</div>
				<div class="flex flex-row items-end">
					<span class="text-2xl">{{ formattedTimestamp }}</span>
				</div>
			</div>
			<div class="mt-1 flex w-full flex-row gap-x-4">
				<div class="flex flex-row items-center">
					<Icon type="thumbs_up" size="sm" />
					<span class="ml-1 text-2xl">{{ topic.likes }}</span>
				</div>
				<div class="flex flex-row items-center">
					<Icon type="thumbs_down" size="sm" />
					<span class="ml-1 text-2xl">{{ topic.dislikes }}</span>
				</div>
				<div class="flex flex-row items-center">
					<Icon type="replies" size="sm" />
					<span class="ml-1 text-2xl">{{ totalReplies }}</span>
					<!---->
				</div>
			</div>
		</div>
	</li>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/H3.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

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

	const formattedTimestamp = computed(() => {
		const date = new Date(topic.timestamp);
		return date.toLocaleDateString();
	});

	const formattedDisplayName = computed(() => {
		if (topic.author) {
			return topic.author.displayName;
		} else {
			return '';
		}
	});

	const formattedUserId = computed(() => {
		if (topic.author) {
			return topic.author.userId.split(':', 1).toString();
		} else {
			return '';
		}
	});
</script>
