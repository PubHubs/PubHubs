<template>
	<div class="bg-surface hover:dark:bg-surface-high mx-auto flex cursor-pointer flex-row gap-4 rounded-xl p-3">
		<div class="relative flex flex-col justify-center">
			<AvatarId :userId="topic.author.userId" />
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
					<div class="flex flex-row items-center">
						<Icon type="thumbs-up" size="sm" />
						<span class="ml-1 text-2xl">{{ topic.likes }}</span>
					</div>
					<div class="flex flex-row items-center">
						<Icon type="thumbs-down" size="sm" />
						<span class="ml-1 text-2xl">{{ topic.dislikes }}</span>
					</div>
					<div class="flex flex-row items-center gap-1">
						<Icon type="chat-circle-text" />
						<span>{{ nrOfReplies }}</span>
					</div>
				</div>
			</div>
			<div class="text-label-small line-clamp-2 grow wrap-break-word">
				{{ topic.body }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import AvatarId from '@hub-client/components/ui/AvatarId.vue';

	import Room from '@hub-client/models/rooms/Room';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const nrOfReplies = ref(0);

	const props = defineProps({
		topic: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	onMounted(async () => {
		props.room?.setCurrentThreadId(props.topic.eventId);
		nrOfReplies.value = props.room?.getCurrentThreadLength() ?? 0;
		// console.info('ThreadItem.onMounted', props.topic.eventId, nrOfReplies.value);
	});
</script>
