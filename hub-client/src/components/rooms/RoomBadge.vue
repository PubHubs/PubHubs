<template>
	<span
		v-if="userHasBadge"
		class="text-label-tiny text-on-surface rounded-base px-075 py-025 pt-025 flex items-center justify-center gap-2 border uppercase"
		:class="userPowerLevel === 100 ? 'border-accent-admin' : userPowerLevel >= 50 ? 'border-accent-steward' : 'border-on-surface-dim'"
		data-testid="event-badges"
		:title="label"
	>
		<span v-if="hasPowerPrivileges || isHubAdmin" class="line-clamp-1 truncate">{{ label }}</span>

		<!-- <template v-else v-for="value in roomAttributes" :key="value">
			<span>{{ value }}</span>
		</template> -->
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	// Types
	interface Props {
		user: string;
		room_id: string;
		isHubAdmin?: boolean;
	}

	// Props
	const props = defineProps<Props>();

	const { t } = useI18n();
	const rooms = useRooms();

	const roomAttributes = ref<string[]>([]);

	const userPowerLevel = computed(() => rooms.currentRoom?.getPowerLevel(props.user) ?? 0);
	const hasPowerPrivileges = computed(() => userPowerLevel.value >= 50);
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
