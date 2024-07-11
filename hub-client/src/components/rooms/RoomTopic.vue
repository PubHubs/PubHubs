<template>
	<span v-if="room?.isPrivateRoom()">
		{{ $t('rooms.private_members') }}
		<PrivateRoomMembersList :members="room?.getOtherJoinedAndInvitedMembers()"></PrivateRoomMembersList>
	</span>
	<span v-else>{{ room?.getTopic() }}</span>
</template>

<script setup lang="ts">
	import Room from '@/model/rooms/Room';
	const props = defineProps({
		room: {
			type: Room,
		},
	});
</script>
