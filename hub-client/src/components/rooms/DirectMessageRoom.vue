<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<!-- Room header with user info -->
		<div class="border-on-surface-disabled flex items-center gap-3 border-b px-4 py-3">
			<Avatar :avatar-url="avatarUrl" icon="user" />
			<div class="flex flex-col">
				<span class="font-semibold">{{ displayName }}</span>
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
	import { computed, onMounted, watch } from 'vue';

	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';
	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Stores
	import { Room } from '@hub-client/stores/rooms';

	const props = defineProps<{
		room: Room;
	}>();

	const displayName = computed(() => {
		if (!props.room) return '';
		const members = props.room.getOtherJoinedAndInvitedMembers();
		if (members.length === 1) {
			return members[0].name || members[0].userId;
		}
		return props.room.name || 'Direct Message';
	});

	const avatarUrl = computed(() => {
		if (!props.room) return '';
		const members = props.room.getOtherJoinedAndInvitedMembers();
		if (members.length === 1) {
			return members[0].getAvatarUrl(props.room.client.baseUrl, 40, 40, 'crop', false, false) || '';
		}
		return props.room.getAvatarUrl(props.room.client.baseUrl, 40, 40, 'crop') || '';
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
