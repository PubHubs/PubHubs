<template>
	<span v-if="userHasBadge" class="flex flex-wrap gap-x-1 gap-y-1 px-4" data-testid="event-badges">
		<span v-if="hasPowerPrivileges || isHubAdmin" class="text-label-small flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white lowercase">
			<Icon type="user" size="sm"></Icon>
			<span v-if="isHubAdmin">{{ hubAdminLabel }}</span>
			<span v-else>{{ powerLevelLabel }}</span>
		</span>
		<span v-else v-for="value in roomAttributes" :key="value" class="text-label-small flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white lowercase">
			<Icon type="check-circle" size="sm"></Icon>
			<span>{{ value }}</span>
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
