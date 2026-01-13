<template>
	<span class="flex flex-row items-center gap-x-2 truncate" :title="displayTitle">
		<!-- Display Name -->
		<span v-if="showDisplayName" data-testid="display-name" class="text-label truncate font-semibold" :class="displayNameClasses">
			{{ truncatedDisplayName }}
		</span>

		<!-- Pseudonym -->
		<span v-if="showPseudonym" class="text-label-small text-nowrap" :class="pseudonymClasses">
			{{ pseudonym }}
		</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { color, textColor } = useUserColor();
	const settings = useSettings();

	interface Props {
		userId: string;
		userDisplayName: string | undefined;
		showDisplayName?: boolean;
		showPseudonym?: boolean;
		chooseColor?: boolean;
	}

	const props = withDefaults(defineProps<Props>(), {
		showDisplayName: true,
		showPseudonym: true,
		chooseColor: true,
		userDisplayName: '',
	});

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
	const userColorClass = computed(() => {
		return props.chooseColor ? textColor(color(props.userId)) : '';
	});

	const displayNameClasses = computed(() => ({
		[userColorClass.value]: props.chooseColor,
	}));

	const pseudonymClasses = computed(() => ({
		'font-semibold': !displayName.value,
		[userColorClass.value]: props.chooseColor && !displayName.value,
	}));
</script>
