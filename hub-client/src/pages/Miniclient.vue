<template>
	<Badge class="text-xxs" color="ph" v-if="unreadMessages > 99">99+</Badge>
	<Badge color="ph" v-else-if="unreadMessages > 0">{{ unreadMessages }}</Badge>
</template>

<script setup lang="ts">
	import Badge from '@/components/elements/Badge.vue';

	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useRooms } from '@/logic/store/rooms';
	import { ref, watch } from 'vue';

	const pubhubs = usePubHubs();
	const rooms = useRooms();

	let unreadMessages = ref<number>(0);

	watch(
		() => rooms.totalUnreadMessages,
		() => {
			unreadMessages.value = rooms.totalUnreadMessages;
		},
	);

	pubhubs.login();
</script>
