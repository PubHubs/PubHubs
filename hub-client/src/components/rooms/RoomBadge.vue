<template>
	<span v-if="userHasBadge" class="flex flex-wrap text-nowrap" data-testid="event-badges" :title="label">
		<span class="text-label-small flex h-4 items-center gap-1 rounded-xl bg-black p-2 text-white lowercase">
			<template v-if="hasPowerPrivileges || isHubAdmin">
				<Icon type="user" size="sm"></Icon>
				<span>{{ label }}</span>
			</template>
			<template v-else v-for="value in roomAttributes" :key="value">
				<Icon type="check-circle" size="sm"></Icon>
				<span>{{ value }}</span>
			</template>
		</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	// Types
	interface Props {
		user: string;
		room_id: string;
		isHubAdmin?: boolean;
	}

	const { t } = useI18n();
	const rooms = useRooms();
	const props = defineProps<Props>();
	const roomAttributes = ref<string[]>([]);

	const hasPowerPrivileges = computed(() => rooms.currentRoom?.getPowerLevel(props.user) ?? 0 >= 50);

	const userHasBadge = computed(() => roomAttributes.value.length > 0 || hasPowerPrivileges.value || props.isHubAdmin);

	const powerLevelLabel = computed(() => (rooms.currentRoom?.getPowerLevel(props.user) === 100 ? t('admin.title_room_administrator') : t('admin.title_room_steward')));
	const hubAdminLabel = computed(() => (props.isHubAdmin ? t('admin.title_hub_administrator') : ''));
	const label = computed(() => {
		if (props.isHubAdmin) return hubAdminLabel.value;
		if (hasPowerPrivileges.value) return powerLevelLabel.value;
		if (roomAttributes.value[0]) return roomAttributes.value[0];
		return '';
	});

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
