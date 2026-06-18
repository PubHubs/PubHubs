<template>
	<div class="flex">
		<UserDisplayName
			v-if="showDisplayname"
			class="mr-100 ml-300"
			:user-display-name="user.userDisplayName(userId)"
			:user-id="userId"
			:room-id="roomId"
		/>
		<Avatar
			:avatar-url="user.userAvatar(userId)"
			class="h-300 w-300 border"
			:title="displayName"
			:user-id="userId"
			:room-id="roomId"
		/>
	</div>
</template>

<script lang="ts" setup>
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
		roomId?: string;
	};

	const props = withDefaults(defineProps<Props>(), { showDisplayname: false, roomId: '' });
	const rooms = useRooms();
	const user = useUser();
	const currentRoom = rooms.currentRoom;
	const displayName = computed(() => {
		return currentRoom?.getMember(props.userId)?.user?.rawDisplayName;
	});
</script>
