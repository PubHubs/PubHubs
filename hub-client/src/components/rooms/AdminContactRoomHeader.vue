<template>
	<div class="flex flex-row gap-2">
		<Avatar :user="undefined" :override-avatar-url="props.room.getRoomAvatarMxcUrl() ?? undefined"></Avatar>
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ props.room.name.startsWith('@') ? $t('menu.contact') : props.room.name }}
			</p>
			<p class="flex leading-tight ~text-label-small-min/label-small-max">
				{{ props.room.getRoomMembers() }} <Icon type="user" size="sm" class="mr-1"></Icon>
				<span class="mx-1"> {{ user.user.rawDisplayName }}<span v-if="members.length > 0">,</span> </span>
				<span class="mx-1" v-for="(member, index) in members" :key="member.userId"> {{ member.rawDisplayName }}<span v-if="index < members.length - 1">,</span> </span>
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Avatar from '../ui/Avatar.vue';

	import { useUser } from '@/logic/store/user';

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
</script>
