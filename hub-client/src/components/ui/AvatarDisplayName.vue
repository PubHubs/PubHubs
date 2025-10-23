<template>
	<div class="flex">
		<UserDisplayName v-if="showDisplayname" class="ml-6 mr-2" :user-id="userId"></UserDisplayName>
		<Avatar class="h-6 w-6 border" :avatar-url="user.userAvatar(userId)" :user-id="userId" :title="displayName"></Avatar>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		userId: string;
		showDisplayname?: boolean;
	};

	const rooms = useRooms();
	const user = useUser();
	const currentRoom = rooms.currentRoom;
	const props = withDefaults(defineProps<Props>(), { showDisplayname: false });

	const displayName = computed(() => {
		return currentRoom?.getMember(props.userId)?.user?.rawDisplayName;
	});
</script>
