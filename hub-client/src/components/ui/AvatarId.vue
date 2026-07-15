<template>
	<div class="flex">
		<UserDisplayName
			v-if="showDisplayname"
			class="mr-2 ml-6"
			:user-display-name="user.userDisplayName(userId)"
			:user-id="userId"
		/>
		<Avatar
			:avatar-url="user.userAvatar(userId)"
			class="h-6 w-6 border"
			:title="displayName"
			:user-id="userId"
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
	};

	const props = withDefaults(defineProps<Props>(), { showDisplayname: false });
	const rooms = useRooms();
	const user = useUser();
	const currentRoom = rooms.currentRoom;

	const displayName = computed(() => {
		return currentRoom?.getMember(props.userId)?.user?.rawDisplayName;
	});
</script>
