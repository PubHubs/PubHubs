<template>
	<div v-if="totalUnreadCount && totalUnreadCount > 0" class="fixed bg-gray-darker theme-light:bg-gray-lighter bottom-48 right-24 border-2 border-white rounded-full w-12 p-3">
		<Icon type="message"></Icon>
		<div class="text-center total">{{ totalUnreadCount }}</div>
	</div>

	<div v-if="totalMentionCount && totalMentionCount > 0" class="fixed bg-gray-darker theme-light:bg-gray-lighter bottom-28 right-24 border-2 rounded-full w-12 p-3">
		<Icon type="mention"></Icon>
		<div class="text-center mention">{{ totalMentionCount }}</div>
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
