<template>
	<span>{{ filters.matrixDisplayName(displayName) }}</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import filters from '../../core/filters';
	import { useUserName } from '@/composables/useUserName';
	import { useRooms } from '@/store/rooms';
	const { getUserDisplayName } = useUserName();

	const rooms = useRooms();

	const props = defineProps({
		user: {
			type: String,
			required: true,
		},
	});

	const displayName = computed(() => {
		const currentRoom = rooms.currentRoom;
		return getUserDisplayName(props.user, currentRoom);
	});
</script>
