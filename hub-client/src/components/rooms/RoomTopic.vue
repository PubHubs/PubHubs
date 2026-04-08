<template>
	<span v-if="DirectRooms.includes(room?.getType() as RoomType)">
		{{ $t('rooms.private_members') }}
		<PrivateRoomMembersList :members="(room?.getOtherJoinedAndInvitedMembers() ?? []) as import('matrix-js-sdk').RoomMember[]" />
	</span>
	<span v-else>{{ room?.getTopic() }}</span>
</template>

<script lang="ts" setup>
	// Components
	import PrivateRoomMembersList from '@hub-client/components/rooms/PrivateRoomMembersList.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { DirectRooms, type RoomType } from '@hub-client/models/rooms/TBaseRoom';

	defineProps({
		room: {
			type: Room,
			default: undefined,
		},
	});
</script>
