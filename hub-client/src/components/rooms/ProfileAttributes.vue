<template>
	<span v-if="roomAttributes.length > 0" class="flex w-full items-center gap-x-1">
		<span
			v-for="value in roomAttributes"
			:key="value"
			:class="value === 'rooms.admin_badge' ? 'bg-accent-primary' : 'bg-surface text-on-surface-variant'"
			class="text-background text-label-small flex w-fit items-center gap-1 rounded-full px-2 lowercase"
		>
			<Icon type="check-circle" size="xs" :class="value === 'rooms.admin_badge' ? 'text-background' : 'text-on-surface-variant'" class="py-1" />
			<span v-if="value === 'rooms.admin_badge'" class="line-clamp-1">{{ $t(value) }}</span>
			<span v-else class="line-clamp-1">{{ value }}</span>
		</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	// Types
	interface Props {
		user: string;
		room_id: string;
	}

	const rooms = useRooms();
	const props = defineProps<Props>();
	const roomAttributes = ref<string[]>([]);

	function update_attributes() {
		if (rooms.roomNotices[props.room_id] && rooms.roomNotices[props.room_id][props.user]) {
			roomAttributes.value = rooms.roomNotices[props.room_id][props.user];
		}
	}

	update_attributes();

	watch(
		() => rooms.roomNotices[props.room_id],
		() => {
			update_attributes();
		},
		{ deep: true },
	);
</script>
