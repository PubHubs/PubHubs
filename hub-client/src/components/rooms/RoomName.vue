<template>
	<span :title="name">{{ name }}</span>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType, computed } from 'vue';

	// Models
	import type Room from '@hub-client/models/rooms/Room';
	import { type RoomListRoom } from '@hub-client/models/rooms/TBaseRoom';

	const props = defineProps({
		room: {
			type: Object as PropType<Room | RoomListRoom>,
			default: undefined,
		},
	});

	// The general room name is of the form #General:<server_name>.
	const name = computed(() => {
		return props.room?.name;
	});
</script>
