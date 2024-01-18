<template>
	<div class="flex flex-row gap-x-2 items-center">
		<span :class="`${textColor(color(user))} font-semibold text-sm`">{{ filters.extractDisplayName(displayName) }}</span>
		<span class="text-xs font-normal">{{ filters.extractPseudonym(displayName) }}</span>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import filters from '../../core/filters';
	import { useUserName } from '@/composables/useUserName';
	import { useRooms } from '@/store/rooms';
	import { useUserColor } from '@/composables/useUserColor';

	const { getUserDisplayName } = useUserName();
	const { color, textColor } = useUserColor();
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
