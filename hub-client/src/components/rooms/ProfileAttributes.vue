<template>
	<span v-if="roomAttributes.length > 0" class="flex w-full items-center gap-x-1">
		<span
			v-for="value in roomAttributes"
			:key="value"
			:class="value === 'rooms.admin_badge' ? 'bg-accent-primary' : 'bg-surface text-on-surface-variant'"
			class="flex w-fit items-center gap-1 rounded-full px-2 lowercase text-background ~text-label-small-min/label-small-max"
		>
			<Icon type="check" size="xs" :class="value === 'rooms.admin_badge' ? 'text-background' : 'text-on-surface-variant'" class="py-1" />
			<span v-if="value === 'rooms.admin_badge'" class="line-clamp-1">{{ $t(value) }}</span>
			<span v-else class="line-clamp-1">{{ value }}</span>
		</span>
	</span>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { useRooms } from '@/logic/store/store';
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
