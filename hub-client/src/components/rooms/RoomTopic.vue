<template>
	<span v-if="room?.isPrivateRoom()">
		{{ $t('rooms.private_members') }}
		<PrivateRoomMembersList :members="room?.getOtherJoinedAndInvitedMembers()" />
	</span>
	<span v-else>{{ room?.getTopic() }}</span>
</template>

<script setup lang="ts">
	// Components
	import PrivateRoomMembersList from './PrivateRoomMembersList.vue';

	import Room from '@/model/rooms/Room';
	const props = defineProps({
		room: {
			type: Room,
		},
	});
</script>
