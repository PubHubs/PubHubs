<template>
	<div class="flex flex-row gap-2">
		<Avatar :avatar-url="user.userAvatar(otherUser?.userId)" :user-id="otherUser?.userId" :icon="users" />
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ otherUser?.rawDisplayName ?? '' }}
			</p>
			<p class="leading-tight text-label-small">
				{{ otherUser?.userId ? filters.extractPseudonym(otherUser.userId) : '' }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const user = useUser();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});

	const otherUser = computed(() => props.members.findLast((member) => member.userId !== user.userId) ?? null);
</script>
