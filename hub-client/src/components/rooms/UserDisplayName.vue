<template>
	<span
		class="flex items-center gap-x-100 truncate"
		:title="displayTitle"
	>
		<!-- Display Name -->
		<span
			v-if="showDisplayName"
			class="text-label-large truncate font-semibold"
			:class="displayNameClasses"
			data-testid="display-name"
		>
			{{ truncatedDisplayName }}
		</span>

		<!-- Pseudonym -->
		<span
			v-if="showPseudonym"
			class="text-label-small text-on-surface-dim text-nowrap"
			:class="pseudonymClasses"
		>
			{{ pseudonym }}
		</span>
	</span>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Composables
	import { useDeactivatedUsers } from '@hub-client/composables/useDeactivatedUsers';
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(defineProps<Props>(), {
		showDisplayName: true,
		showPseudonym: true,
		chooseColor: true,
		userDisplayName: '',
		roomId: '',
	});
	const { color, textColor } = useUserColor();
	const { ensureKnown } = useDeactivatedUsers();
	const { t } = useI18n();
	const rooms = useRooms();
	const settings = useSettings();
	const user = useUser();

	interface Props {
		userId: string;
		userDisplayName: string | undefined;
		showDisplayName?: boolean;
		showPseudonym?: boolean;
		chooseColor?: boolean;
		roomId?: string;
	}

	// An account that has been deleted is shown as such, under neither its display name nor its
	// pseudonym: the pseudonym is the handle others remember someone by, so leaving it on screen
	// would keep identifying the person who asked to be gone.
	const isDeleted = computed(() => user.isDeactivatedUser(props.userId));

	// get Pseudonym
	const pseudonym = computed(() => {
		if (isDeleted.value) return '';
		return filters.extractPseudonym(props.userId);
	});

	// If the display Name is not set then userDisplayName is equal to rawDisplayName. We only show pseudo
	const displayName = computed(() => {
		if (isDeleted.value) return t('others.deleted_account');
		return props.userDisplayName ? props.userDisplayName : undefined;
	});

	const truncatedDisplayName = computed(() => {
		return filters.maxLengthText(displayName.value ?? '', settings.getDisplayNameMaxLength);
	});

	// Computed properties for display logic
	const showDisplayName = computed(() => props.showDisplayName && displayName.value);

	const showPseudonym = computed(() => props.showPseudonym && pseudonym.value);

	const displayTitle = computed(() => {
		const parts = [];
		if (displayName.value) parts.push(displayName.value);
		if (pseudonym.value) parts.push(pseudonym.value);
		return parts.join(' - ');
	});

	// Computed properties for styling
	const isSteward = computed(() => {
		if (!props.roomId) return false;
		const room = rooms.room(props.roomId);
		if (!room) return false;
		if (room.isDirectMessageRoom()) return false;
		return room.getPowerLevel(props.userId) >= UserPowerLevel.Steward;
	});

	const userColorClass = computed(() => {
		// The colour is derived from the user id, so it would still tell this person apart.
		if (isDeleted.value) return 'text-on-surface-dim';
		if (isSteward.value) return 'text-accent-steward';
		return props.chooseColor ? textColor(color(props.userId)) : '';
	});

	const displayNameClasses = computed(() => ({
		[userColorClass.value]: true,
	}));

	const pseudonymClasses = computed(() => ({
		'font-semibold': !displayName.value,
		[userColorClass.value]: !displayName.value,
	}));

	// Members of the room come with a display name, so the ones worth asking the hub about are
	// those we have none for - which is exactly how a deleted account presents itself. Callers
	// that pass `rawDisplayName` hand us the Matrix id rather than nothing when the name is
	// missing, so that counts as having none.
	watch(
		() => [props.userId, props.userDisplayName] as const,
		([userId, userDisplayName]) => {
			if (userId && (!userDisplayName || userDisplayName === userId)) ensureKnown([userId]);
		},
		{ immediate: true },
	);
</script>
