<template>
	<span
		v-if="shouldShowBadge"
		class="text-label-tiny rounded-base px-075 py-025 pt-025 flex items-center justify-center gap-100 border-2 uppercase"
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

	// Composables
	import { usePowerLevels } from '@hub-client/composables/usePowerLevels';

	// Models
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	// Types
	interface Props {
		user: string;
		roomId: string;
	}

	// Props
	const props = defineProps<Props>();

	const { t } = useI18n();
	const rooms = useRooms();
	const { powerLevel } = usePowerLevels();

	const userPowerLevel = computed(() => powerLevel(props.roomId, props.user));

	const isAdmin = computed(() => userPowerLevel.value === UserPowerLevel.Admin);
	const isSteward = computed(() => userPowerLevel.value >= UserPowerLevel.Steward);
	const isRoomSteward = computed(() => isAdmin.value || isSteward.value);

	// Check if user is an expert based on power level (>= 25)
	const isExpert = computed(() => userPowerLevel.value >= UserPowerLevel.Expert);

	const hasPrivileges = computed(() => isExpert.value || isRoomSteward.value);

	const roomAttributes = computed(() => {
		return rooms.roomNotices[props.roomId]?.[props.user] ?? {};
	});

	const roomAttributeEntries = computed(() => Object.entries(roomAttributes.value));

	const shouldShowBadge = computed(() => {
		return hasPrivileges.value || roomAttributeEntries.value.length > 0;
	});

	const badgeLabel = computed(() => {
		if (isRoomSteward.value) return t('admin.title_room_steward');
		if (isExpert.value) return t('expert.expert');
		if (roomAttributeEntries.value.length > 0) {
			const [, value] = roomAttributeEntries.value[0];
			return value.includes('.') ? t(value) : value;
		}
		return '';
	});

	const badgeTitle = computed(() => {
		if (isRoomSteward.value) {
			return badgeLabel.value;
		}
		if (isExpert.value) {
			return t('expert.expert');
		}
		if (roomAttributeEntries.value.length > 0) {
			const [attribute, value] = roomAttributeEntries.value[0];
			const displayValue = value.includes('.') ? t(value) : value;
			return `${attribute}: ${displayValue}`;
		}
		return '';
	});

	const badgeClasses = computed(() => {
		if (isRoomSteward.value) return 'border-accent-steward text-accent-steward';
		if (isExpert.value) return 'border-accent-expert text-accent-expert';
		return 'border-on-surface-dim text-on-surface-dim';
	});
</script>
