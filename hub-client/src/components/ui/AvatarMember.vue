<template>
	<div class="flex">
		<UserDisplayName v-if="showDisplayname" class="ml-6 mr-2" :user="userId" :room="currentRoom"></UserDisplayName>
		<Avatar class="h-6 w-6 border" :user="getUser" :title="displayName"></Avatar>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRooms } from '@/logic/store/rooms';
	const rooms = useRooms();
	const currentRoom = rooms.currentRoom;

	type Props = {
		userId: string;
		showDisplayname?: boolean;
	};
	const props = withDefaults(defineProps<Props>(), { showDisplayname: false });

	const getUser = computed(() => {
		const member = currentRoom?.getMember(props.userId);
		return member;
	});

	const displayName = computed(() => {
		return currentRoom?.getMember(props.userId)?.user?.rawDisplayName;
	});
</script>
