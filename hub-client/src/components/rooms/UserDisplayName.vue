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
	import { computed } from 'vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const props = withDefaults(defineProps<Props>(), {
		showDisplayName: true,
		showPseudonym: true,
		chooseColor: true,
		userDisplayName: '',
		roomId: '',
	});
	const { color, textColor } = useUserColor();
	const rooms = useRooms();
	const settings = useSettings();

	interface Props {
		userId: string;
		userDisplayName: string | undefined;
		showDisplayName?: boolean;
		showPseudonym?: boolean;
		chooseColor?: boolean;
		roomId?: string;
	}

	// get Pseudonym
	const pseudonym = computed(() => {
		return filters.extractPseudonym(props.userId);
	});

	// If the display Name is not set then userDisplayName is equal to rawDisplayName. We only show pseudo
	const displayName = computed(() => {
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
		return room.getPowerLevel(props.userId) >= 50;
	});

	const userColorClass = computed(() => {
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
</script>
