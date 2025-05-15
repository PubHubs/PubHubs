<template>
	<span v-if="userHasBadge" class="flex gap-x-1">
		<span v-if="hasPowerPrivileges || isHubAdmin" class="ml-2 flex h-4 min-w-full items-center gap-1 rounded-xl bg-black px-2 lowercase text-white ~text-label-small-min/label-small-max">
			<Icon type="power_level" class="-mr-3 mt-3"></Icon>
			<span v-if="isHubAdmin">{{ hubAdminLabel }}</span>
			<span v-else>{{ powerLevelLabel }}</span>
		</span>
		<span v-else v-for="value in roomAttributes" :key="value" class="ml-2 flex h-4 min-w-full items-center gap-1 rounded-xl bg-black px-2 lowercase text-white ~text-label-small-min/label-small-max">
			<Icon type="check" :size="'xs'"></Icon>
			<span>{{ value }}</span>
		</span>
	</span>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { useRooms } from '@/logic/store/store';
	import { ref, watch, computed, onMounted } from 'vue';

	const rooms = useRooms();

	interface Props {
		user: string;
		room_id: string;
		isHubAdmin?: boolean;
	}

	const props = defineProps<Props>();

	const roomAttributes = ref<string[]>([]);

	const hasPowerPrivileges = computed(() => rooms.currentRoom?.getPowerLevel(props.user) >= 50);

	const userHasBadge = computed(() => roomAttributes.value.length > 0 || hasPowerPrivileges.value || props.isHubAdmin);

	const powerLevelLabel = computed(() => (rooms.currentRoom?.getPowerLevel(props.user) === 100 ? 'Room administrator' : 'Room steward'));

	const hubAdminLabel = computed(() => (props.isHubAdmin ? 'Hub Administrator' : ''));

	function update_attributes() {
		if (rooms.roomNotices[props.room_id] && rooms.roomNotices[props.room_id][props.user]) {
			roomAttributes.value = rooms.roomNotices[props.room_id][props.user];
		} else {
			roomAttributes.value = [];
		}
	}
	onMounted(() => update_attributes());
	watch(
		() => rooms.roomNotices[props.room_id],
		() => {
			update_attributes();
		},
		{ deep: true },
	);
</script>
