<template>
	<div class="rounded-full w-12 h-12">
		<img v-if="img != ''" :src="img" :alt="alt" :class="rooms.currentRoom === undefined ? 'w-32 h-32 rounded-full border-2 border-blue-500' : 'rounded-full w-12 h-12'" />
	</div>
</template>

<script setup lang="ts">
	import { useRooms } from '@/store/rooms';

	const rooms = useRooms();

	const props = defineProps({
		img: {
			type: String,
			default: '',
		},
		alt: {
			type: String,
			default: '',
		},
	});
</script>
