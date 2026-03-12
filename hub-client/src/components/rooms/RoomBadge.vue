<template>
	<span v-if="shouldShowBadge" class="text-label-tiny text-on-surface rounded-base px-075 py-025 pt-025 flex items-center justify-center gap-2 border uppercase" :class="badgeClasses" data-testid="event-badges" :title="badgeLabel">
		<span class="line-clamp-1 truncate">{{ badgeLabel }}</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Models
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

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

	const room = computed(() => rooms.room(props.room_id));
	const powerLevelState = computed(() => room.value?.getStatePowerLevel()?.content);

	const userPowerLevel = computed(() => {
		const r = room.value;
		if (!r) return 0;
		const statePowerLevel = powerLevelState.value?.users?.[props.user] ?? powerLevelState.value?.users_default;
		if (typeof statePowerLevel === 'number') return statePowerLevel;
		// I don't think this is needed anymore as a fallback.
		const memberPowerLevel = r.getPowerLevel(props.user);
		return memberPowerLevel >= 0 ? memberPowerLevel : 0;
	});

	const isAdmin = computed(() => userPowerLevel.value === UserPowerLevel.Admin);
	const isSuperSteward = computed(() => userPowerLevel.value >= UserPowerLevel.SuperSteward);
	const isSteward = computed(() => userPowerLevel.value >= UserPowerLevel.Steward);
	const isExpert = computed(() => userPowerLevel.value >= UserPowerLevel.Expert);

	const hasPrivileges = computed(() => isExpert.value || isSteward.value || isSuperSteward.value || isAdmin.value);

	const roomAttributes = computed(() => {
		return rooms.roomNotices[props.room_id]?.[props.user] ?? [];
	});

	const shouldShowBadge = computed(() => {
		return props.isHubAdmin || hasPrivileges.value || roomAttributes.value.length > 0;
	});

	const badgeLabel = computed(() => {
		if (props.isHubAdmin) return t('admin.title_hub_administrator');
		if (isAdmin.value) return t('admin.title_room_administrator');
		if (isSteward.value || isSuperSteward.value) return t('admin.title_room_steward');
		if (roomAttributes.value.length > 0) {
			const attr = roomAttributes.value[0];
			return attr.includes('.') ? t(attr) : attr;
		}
		return '';
	});

	const badgeClasses = computed(() => {
		if (isAdmin.value) return 'border-accent-admin';
		if (isSteward.value || isSuperSteward.value) return 'border-accent-steward';
		if (isExpert.value) return 'border-on-surface-dim';
		return 'border-on-surface-dim';
	});
</script>
