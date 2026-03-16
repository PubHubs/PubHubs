<template>
	<div v-if="topic" class="bg-surface-high flex items-center gap-2 truncate rounded-md px-2 text-nowrap hover:cursor-pointer">
		<p class="text-nowrap">{{ $t('message.in_reply_to') }}</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :user="topic.author?.userId!" :room="room" />
		</p>
		<div class="line-clamp-1 flex-1" :title="topic?.body">
			{{ topic?.body }}
		</div>
	</div>
</template>

<script setup lang="ts">
	import UserDisplayName from '@/components/rooms/UserDisplayName.vue';
	import { useUserColor } from '@/logic/composables/useUserColor';
	import type Room from '@/model/rooms/Room';
	import { TThread } from '@/plugins/PluginRoomTypeForum/TThread';
	import { useForumStore } from '@/plugins/PluginRoomTypeForum/core/forumStore';
	import { computed } from 'vue';

	const props = defineProps<{
		eventId: string;
		room: Room;
	}>();

	const forumStore = useForumStore();
	const topic = computed(() => forumStore.findThreadByEventId(props.eventId) as TThread);

	const { color, textColor } = useUserColor();
	const userColor = computed(() => color(topic.value.author?.userId!) || 0);
</script>
