<template>
	<div v-if="roomAttributes.length > 0" class="flex gap-x-1">
		<div v-for="value in roomAttributes" :key="value" :class="value === 'rooms.admin_badge' ? 'bg-red' : 'bg-black'" class="text-white text-xs lowercase px-1 rounded h-4 flex gap-1 items-center">
			<Icon type="check" class="mt-3 -mr-3"></Icon>
			<span v-if="value === 'rooms.admin_badge'">{{ $t(value) }}</span>
			<span v-else>{{ value }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useRooms } from '@/store/store';
	import { ref, watch } from 'vue';

	const rooms = useRooms();

	const props = defineProps({
		user: {
			type: String,
			required: true,
		},
		room_id: {
			type: String,
			required: true,
		},
	});

	const roomAttributes: Ref<String[]> = ref([]);

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
