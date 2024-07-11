<template>
	{{ $t('rooms.me') }} &amp;
	<span v-for="(member, index) in members" :key="index">
		<span v-if="index > 0"> &bull; </span>
		{{ member.rawDisplayName }}
	</span>
</template>

<script setup lang="ts">
	import { RoomMember } from 'matrix-js-sdk';
	defineProps({
		members: {
			type: Array<RoomMember>,
			required: true,
		},
	});
</script>
