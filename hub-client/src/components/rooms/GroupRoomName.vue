<template>
	{{ $t('rooms.me') }} &amp;
	<span v-for="(member, index) in members" :key="index">
		<span v-if="index > 0"> &amp; </span>
		{{ member.rawDisplayName }}
	</span>
</template>

<script setup lang="ts">
	// Models
	import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	defineProps({
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});
</script>
