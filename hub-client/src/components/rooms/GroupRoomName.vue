<template>
	{{ $t('rooms.me') }} &amp;
	<span
		v-for="(member, index) in members"
		:key="index"
	>
		<span v-if="index > 0"> &amp; </span>
		<MemberName
			:raw-display-name="member.rawDisplayName"
			:user-id="member.userId"
		/>
	</span>
</template>

<script lang="ts" setup>
	// Components
	import MemberName from '@hub-client/components/rooms/MemberName.vue';

	// Models
	import { type TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	defineProps({
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});
</script>
