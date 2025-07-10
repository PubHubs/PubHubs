<template>
	<div v-if="(totalUnreadCount && totalUnreadCount > 0) || (totalMentionCount && totalMentionCount > 0)" class="bg-gray-darker theme-light:bg-gray-lighter absolute right-0 top-0 flex w-fit gap-4 rounded-l-xl rounded-t-none p-2">
		<div v-if="totalUnreadCount && totalUnreadCount > 0" class="flex gap-1">
			<Icon type="message" />
			<div class="total">{{ totalUnreadCount }}</div>
		</div>

		<div v-if="totalMentionCount && totalMentionCount > 0" class="flex gap-1">
			<Icon type="mention" />
			<div class="mention">{{ totalMentionCount }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRooms } from '@/logic/store/store';
	import { watchEffect } from 'vue';

	import Icon from '@/components/elements/Icon.vue';

	const rooms = useRooms();

	let totalUnreadCount = ref<number | undefined>(0);
	let totalMentionCount = ref<number | undefined>(0);

	watchEffect(() => {
		totalUnreadCount.value = rooms.unreadMessageNotification();
		totalMentionCount.value = rooms.unreadMentionNotification();
	});
</script>
