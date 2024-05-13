<template>
	<div class="flex flex-row gap-x-2 items-center text-nowrap">
		<span :class="`${textColor(color(user))} font-semibold text-sm`">{{ filters.maxLengthText(displayName, settings.getDisplayNameMaxLength) }}</span>
		<span class="text-xs font-normal">{{ filters.extractPseudonym(user) }}</span>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import filters from '@/core/filters';
	import { useSettings } from '@/store/store';
	import { useUserName } from '@/composables/useUserName';
	import { useRooms } from '@/store/rooms';
	import { useUserColor } from '@/composables/useUserColor';

	const { getUserDisplayName } = useUserName();
	const { color, textColor } = useUserColor();
	const rooms = useRooms();
	const settings = useSettings();

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
