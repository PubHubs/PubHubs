<template>
	<span v-if="DirectRooms.includes(room?.getType() as RoomType)">
		{{ $t('rooms.private_members') }}
		<PrivateRoomMembersList :members="room?.getOtherJoinedAndInvitedMembers()" />
	</span>
	<span v-else>{{ room?.getTopic() }}</span>
</template>

<script setup lang="ts">
	// Components
	import PrivateRoomMembersList from '@hub-client/components/rooms/PrivateRoomMembersList.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';

	const props = defineProps({
		room: {
			type: Room,
		},
	});
</script>
