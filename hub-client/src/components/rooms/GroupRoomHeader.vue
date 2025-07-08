<template>
	<div class="flex flex-row gap-2">
		<AvatarCore :img="props.room.getRoomAvatarMxcUrl() ?? undefined" icon="two_users" />

		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ props.room.name }}
			</p>

			<p class="flex leading-tight ~text-label-small-min/label-small-max">
				{{ props.room.getRoomMembers() }}
				<Icon type="user" size="sm" class="mr-1" />

				<span class="mx-1">
					{{ user.user.rawDisplayName }}
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
	import AvatarCore from '../ui/AvatarCore.vue';
	import { useUser } from '@/logic/store/user';
	import { computed } from 'vue';

	import Room from '@/model/rooms/Room';
	import { TRoomMember } from '@/model/rooms/TRoomMember';

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
	const memberList = computed(() => props.members.filter((m) => m.userId !== user.user.userId));
</script>
