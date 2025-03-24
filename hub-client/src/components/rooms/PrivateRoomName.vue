<template>
	{{ $t('rooms.me') }} &amp;
	<span v-for="(member, index) in members" :key="index">
		<span v-if="index > 0"> &bull; </span>
		{{ member.rawDisplayName }}
	</span>
</template>

<script setup lang="ts">
	import { TRoomMember } from '@/model/rooms/TRoomMember';
	defineProps({
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});
</script>
