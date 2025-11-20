<template>
	<div v-if="(totalUnreadCount && totalUnreadCount > 0) || (totalMentionCount && totalMentionCount > 0)" class="bg-gray-darker theme-light:bg-gray-lighter absolute top-0 right-0 flex w-fit gap-4 rounded-t-none rounded-l-xl p-2">
		<div v-if="totalUnreadCount && totalUnreadCount > 0" class="flex gap-1">
			<Icon type="chats-circle" />
			<div class="total">{{ totalUnreadCount }}</div>
		</div>

		<div v-if="totalMentionCount && totalMentionCount > 0" class="flex gap-1">
			<Icon type="at" />
			<div class="mention">{{ totalMentionCount }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref, watchEffect } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();

	let totalUnreadCount = ref<number | undefined>(0);
	let totalMentionCount = ref<number | undefined>(0);

	watchEffect(() => {
		totalUnreadCount.value = rooms.unreadMessageNotification();
		totalMentionCount.value = rooms.unreadMentionNotification();
	});
</script>
