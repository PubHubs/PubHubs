<template>
	<span v-for="(member, index) in members" :key="index">
		<span v-if="index > 0"> &bull; </span>
		{{ member.name }}
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { RoomMember } from 'matrix-js-sdk';

	defineProps({
		members: {
			type: Array<RoomMember>,
			required: true,
		},
	});
</script>
