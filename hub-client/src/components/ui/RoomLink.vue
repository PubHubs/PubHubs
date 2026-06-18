<template>
	<div
		role="link"
		tabindex="0"
		class="hover:bg-surface-sunken flex w-full cursor-pointer items-center gap-100 rounded-md p-100"
		@click="navigate"
		@keydown.enter="navigate"
		@keydown.space.prevent="navigate"
	>
		<Icon
			:type="roomIcon"
			size="sm"
		/>
		<span class="truncate text-sm">{{ name }}</span>
	</div>
</template>

<script lang="ts" setup>
	import { computed } from 'vue';
	import { useRouter } from 'vue-router';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useRoles } from '@hub-client/composables/roles.composable';

	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	const props = defineProps<{
		roomId: string;
		name: string;
	}>();
	const router = useRouter();
	const rooms = useRooms();
	const settings = useSettings();
	const { userPowerLevel } = useRoles();

	const roomIcon = computed(() => {
		if (rooms.roomIsSecure(props.roomId)) return 'shield';
		const entry = rooms.roomList.find((r) => r.roomId === props.roomId);
		if (settings.isFeatureEnabled(FeatureFlag.forumRooms) && entry?.roomType === RoomType.PH_FORUM_ROOM) return 'chat-circle-text';
		return 'chats-circle';
	});

	function navigate() {
		if (userPowerLevel(props.roomId) >= UserPowerLevel.Steward) {
			router.push({ name: 'manage-rooms', query: { roomId: props.roomId } });
		} else {
			router.push({ name: 'room', params: { id: props.roomId } });
		}
	}
</script>
