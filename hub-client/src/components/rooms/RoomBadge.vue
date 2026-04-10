<template>
	<span
		v-if="shouldShowBadge"
		class="text-label-tiny text-on-surface rounded-base px-075 py-025 pt-025 flex items-center justify-center gap-2 border uppercase"
		:class="badgeClasses"
		data-testid="event-badges"
		:title="badgeTitle"
	>
		<span class="line-clamp-1 truncate">{{ badgeLabel }}</span>
	</span>
</template>

<script lang="ts" setup>
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
		roomId: string;
		isHubAdmin?: boolean;
	}

	// Props
	const props = defineProps<Props>();

	const { t } = useI18n();
	const rooms = useRooms();

	const room = computed(() => rooms.room(props.roomId));
	const powerLevelState = computed(() => room.value?.getStatePowerLevel()?.content);

	const userPowerLevel = computed(() => {
		const r = room.value;
		if (!r) return 0;
		const statePowerLevel = powerLevelState.value?.users?.[props.user] ?? powerLevelState.value?.users_default;
		if (typeof statePowerLevel === 'number') return statePowerLevel;

		const memberPowerLevel = r.getPowerLevel(props.user);
		return memberPowerLevel >= 0 ? memberPowerLevel : 0;
	});

	const isAdmin = computed(() => userPowerLevel.value === UserPowerLevel.Admin);
	const isSuperSteward = computed(() => userPowerLevel.value >= UserPowerLevel.SuperSteward);
	const isSteward = computed(() => userPowerLevel.value >= UserPowerLevel.Steward);
	const isExpert = computed(() => userPowerLevel.value >= UserPowerLevel.Expert);

	const hasPrivileges = computed(() => isExpert.value || isSteward.value || isSuperSteward.value || isAdmin.value);

	const roomAttributes = computed(() => {
		return rooms.roomNotices[props.roomId]?.[props.user] ?? {};
	});

	const roomAttributeEntries = computed(() => Object.entries(roomAttributes.value));

	const shouldShowBadge = computed(() => {
		return props.isHubAdmin || hasPrivileges.value || roomAttributeEntries.value.length > 0;
	});

	const badgeLabel = computed(() => {
		if (props.isHubAdmin) return t('admin.title_hub_administrator');
		if (isAdmin.value) return t('admin.title_room_administrator');
		if (isSteward.value || isSuperSteward.value) return t('admin.title_room_steward');
		if (roomAttributeEntries.value.length > 0) {
			const [, value] = roomAttributeEntries.value[0];
			return value.includes('.') ? t(value) : value;
		}
		return '';
	});

	const badgeTitle = computed(() => {
		if (props.isHubAdmin || isAdmin.value || isSteward.value || isSuperSteward.value) {
			return badgeLabel.value;
		}
		if (roomAttributeEntries.value.length > 0) {
			const [attribute, value] = roomAttributeEntries.value[0];
			const displayValue = value.includes('.') ? t(value) : value;
			return `${attribute}: ${displayValue}`;
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
