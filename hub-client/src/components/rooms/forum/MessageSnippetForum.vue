<template>
	<div v-if="topic" class="bg-surface-high flex items-center gap-2 truncate rounded-md px-2 text-nowrap hover:cursor-pointer">
		<p class="text-nowrap">{{ $t('message.in_reply_to') }}</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :userId="topic.author?.userId!" :user-display-name="topic.author?.displayName"></UserDisplayName>
		</p>
		<div class="line-clamp-1 flex-1" :title="topic?.body">
			{{ topic?.body }}
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	import { useUserColor } from '@hub-client/composables/useUserColor';

	import { TThread } from '@hub-client/models/events/forum/TThread';
	import type Room from '@hub-client/models/rooms/Room';

	import { useForumStore } from '@hub-client/stores/forum/forumStore';

	const props = defineProps<{
		eventId: string;
		room: Room;
	}>();

	const forumStore = useForumStore();
	const topic = computed(() => forumStore.findThreadByEventId(props.eventId) as TThread);

	const { color, textColor } = useUserColor();
	const userColor = computed(() => color(topic.value.author?.userId!) || 0);
</script>
