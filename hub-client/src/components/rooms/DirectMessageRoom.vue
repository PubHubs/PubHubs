<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<!-- Room header with user info -->
		<div class="border-on-surface-disabled flex items-center gap-3 border-b px-4 py-3">
			<Avatar :avatar-url="avatarUrl" :user-id="otherUserId" icon="user" />
			<div class="flex flex-col overflow-hidden">
				<span class="truncate font-semibold">{{ displayName }}</span>
				<span v-if="pseudonym" class="text-label-small text-on-surface-dim truncate">{{ pseudonym }}</span>
			</div>
		</div>

		<!-- Timeline -->
		<div class="flex h-full w-full flex-col overflow-hidden">
			<RoomTimeline v-if="room" :room="room" />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, watch } from 'vue';

	// Components
	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { Room } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const user = useUser();

	const props = defineProps<{
		room: Room;
	}>();

	const otherUser = computed(() => {
		if (!props.room) return null;
		const members = props.room.getOtherJoinedAndInvitedMembers();
		return members.length > 0 ? members[0] : null;
	});

	const otherUserId = computed(() => otherUser.value?.userId);

	const displayName = computed(() => {
		if (!props.room) return '';
		if (otherUser.value) {
			return otherUser.value.rawDisplayName || otherUser.value.name || otherUser.value.userId;
		}
		return props.room.name || 'Direct Message';
	});

	const pseudonym = computed(() => {
		if (!otherUser.value?.userId) return '';
		return filters.extractPseudonym(otherUser.value.userId);
	});

	const avatarUrl = computed(() => {
		if (!otherUser.value?.userId) return '';
		return user.userAvatar(otherUser.value.userId);
	});

	// Initialize timeline when room changes
	watch(
		() => props.room,
		(newRoom) => {
			if (newRoom) {
				newRoom.initTimeline();
			}
		},
		{ immediate: true },
	);
</script>
