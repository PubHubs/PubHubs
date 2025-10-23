<template>
	<div class="flex flex-row gap-2">
		<Avatar :avatar-url="props.room.getRoomAvatarMxcUrl() ?? undefined"></Avatar>
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ props.room.name.startsWith('@') ? $t('admin.support') : props.room.name }}
			</p>
			<p class="flex leading-tight ~text-label-small-min/label-small-max">
				{{ props.room.getRoomMembers() }} <Icon type="user" size="sm" class="mr-1"></Icon>
				<span class="mx-1"> {{ user.rawDisplayName }}<span v-if="members.length > 0">,</span> </span>
				<span class="mx-1" v-for="(member, index) in members" :key="member.userId"> {{ member.rawDisplayName }}<span v-if="index < members.length - 1">,</span> </span>
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
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
</script>
