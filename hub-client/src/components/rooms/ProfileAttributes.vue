<template>
	<span v-if="roomAttributes.length > 0" class="flex gap-x-1">
		<span v-for="value in roomAttributes" :key="value" :class="value === 'rooms.admin_badge' ? 'bg-red' : 'bg-black'" class="flex h-4 items-center gap-1 rounded px-1 text-xs lowercase text-white">
			<Icon type="check" class="-mr-3 mt-3"></Icon>
			<span v-if="value === 'rooms.admin_badge'">{{ $t(value) }}</span>
			<span v-else>{{ value }}</span>
		</span>
	</span>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { useRooms } from '@/store/store';
	import { ref, watch } from 'vue';

	const rooms = useRooms();

	interface Props {
		user: string;
		room_id: string;
	}

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
