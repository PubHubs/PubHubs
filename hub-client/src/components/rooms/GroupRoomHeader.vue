<template>
	<div class="flex flex-row gap-2">
		<Avatar :avatar-url="props.room.getRoomAvatarMxcUrl() ?? undefined" icon="two_users" />

		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ props.room.name }}
			</p>

			<p class="flex leading-tight text-label-small">
				{{ props.room.getRoomMembers() }}
				<Icon type="user" size="sm" class="mr-1" />

				<span class="mx-1">
					{{ user.rawDisplayName }}
					<span v-if="memberList.length > 0">,</span>
				</span>

				<span class="mx-1 truncate" v-for="(member, index) in memberList" :key="member.userId">
					{{ member.rawDisplayName }}
					<span v-if="index < memberList.length - 1">,</span>
				</span>
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

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

	// All members except current user
	const memberList = computed(() => props.members.filter((m) => m.userId !== user.userId));
</script>
