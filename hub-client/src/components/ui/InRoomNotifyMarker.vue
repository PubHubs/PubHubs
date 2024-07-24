<template>
	<div v-if="(totalUnreadCount && totalUnreadCount > 0) || (totalMentionCount && totalMentionCount > 0)" class="flex gap-4 p-2 rounded-l-xl rounded-t-none w-fit absolute top-0 right-0 bg-gray-darker theme-light:bg-gray-lighter">
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
