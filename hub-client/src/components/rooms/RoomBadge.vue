<template>
	<span v-if="userHasBadge" class="flex flex-wrap gap-x-1 gap-y-1 px-4">
		<span v-if="hasPowerPrivileges || isHubAdmin" class="flex h-4 items-center gap-1 rounded-xl bg-black px-2 lowercase text-white ~text-label-small-min/label-small-max">
			<Icon type="power_level" class="-mr-3 mt-3"></Icon>
			<span v-if="isHubAdmin">{{ hubAdminLabel }}</span>
			<span v-else>{{ powerLevelLabel }}</span>
		</span>
		<span v-else v-for="value in roomAttributes" :key="value" class="flex h-4 items-center gap-1 rounded-xl bg-black px-2 lowercase text-white ~text-label-small-min/label-small-max">
			<Icon type="check" class="-mr-3 mt-3"></Icon>
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
