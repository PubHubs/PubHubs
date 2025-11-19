<template>
	<div class="flex flex-row gap-2">
		<Avatar :avatar-url="undefined" :icon="'users'"></Avatar>
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ props.room.name.startsWith('@') ? $t('admin.support') : props.room.name }}
			</p>
			<p class="flex leading-tight text-label-small">{{ props.room.getRoomMembers() }} <Icon type="user" class="mr-1"></Icon></p>
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
