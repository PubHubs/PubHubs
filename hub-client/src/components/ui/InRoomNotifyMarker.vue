<template>
	<div v-if="(totalUnreadCount && totalUnreadCount > 0) || (totalMentionCount && totalMentionCount > 0)" class="absolute right-0 top-0 flex w-fit gap-4 rounded-l-xl rounded-t-none bg-gray-darker p-2 theme-light:bg-gray-lighter">
		<div v-if="totalUnreadCount && totalUnreadCount > 0" class="flex gap-1">
			<Icon type="message"></Icon>
			<div class="total">{{ totalUnreadCount }}</div>
		</div>

		<div v-if="totalMentionCount && totalMentionCount > 0" class="flex gap-1">
			<Icon type="mention"></Icon>
			<div class="mention">{{ totalMentionCount }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRooms } from '@/store/store';
	import { watchEffect } from 'vue';
	const rooms = useRooms();

	let totalUnreadCount = ref<number | undefined>(0);
	let totalMentionCount = ref<number | undefined>(0);

	watchEffect(() => {
		totalUnreadCount.value = rooms.unreadMessageNotification();
		totalMentionCount.value = rooms.unreadMentionNotification();
	});
</script>
