<template>
	<div class="flex">
		<UserDisplayName v-if="showDisplayname" class="ml-6 mr-2" :user="userId" :room="currentRoom"></UserDisplayName>
		<Avatar class="h-6 w-6 border" :userId="userId" :title="displayName"></Avatar>
	</div>
</template>

<script setup lang="ts">
	/**
	 * This Avatar is used in cases where you only have a UserId and if you need to show the DisplayName next to it.
	 * Mostly used by the VotingWidget(s)
	 */

	import { computed } from 'vue';
	import { useRooms } from '@/logic/store/rooms';

	// Components
	import Avatar from '@/components/ui/Avatar.vue';

	const rooms = useRooms();
	const currentRoom = rooms.currentRoom;

	type Props = {
		userId: string;
		showDisplayname?: boolean;
	};
	const props = withDefaults(defineProps<Props>(), { showDisplayname: false });

	const displayName = computed(() => {
		return currentRoom?.getMember(props.userId)?.user?.rawDisplayName;
	});
</script>
