<template>
	<span class="flex flex-row items-center gap-x-2 truncate" :title="displayTitle">
		<!-- Display Name -->
		<span v-if="showDisplayName" data-testid="display-name" :class="displayNameClasses">
			{{ truncatedDisplayName }}
		</span>

		<!-- Pseudonym -->
		<span v-if="showPseudonym" :class="pseudonymClasses">
			{{ pseudonym }}
		</span>
	</span>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/logic/composables/useUserColor';
	import filters from '@/logic/core/filters';
	import { computed } from 'vue';
	import Room from '@/model/rooms/Room';
	import { useSettings } from '@/logic/store/settings';

	const { color, textColor } = useUserColor();
	const settings = useSettings();

	interface Props {
		user: string;
		room: Room;
		showDisplayName?: boolean;
		showPseudonym?: boolean;
		chooseColor?: boolean;
	}

	const props = withDefaults(defineProps<Props>(), {
		showDisplayName: true,
		showPseudonym: true,
		chooseColor: true,
	});

	// Computed properties for data
	const member = computed(() => props.room.getMember(props.user));

	const displayName = computed(() => {
		const memberData = member.value;
		// If the display name is not set, we get user Id. In that case return empty display name.
		if (props.user === memberData?.rawDisplayName || filters.extractPseudonym(props.user) === memberData?.rawDisplayName) {
			return '';
		}
		return memberData?.rawDisplayName || '';
	});

	const pseudonym = computed(() => filters.extractPseudonym(props.user));

	const truncatedDisplayName = computed(() => filters.maxLengthText(displayName.value, settings.getDisplayNameMaxLength));

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
	const userColorClass = computed(() => (props.chooseColor ? textColor(color(props.user)) : ''));

	const displayNameClasses = computed(() => ({
		truncate: true,
		'font-semibold': true,
		'~text-label-min/label-max': true,
		[userColorClass.value]: props.chooseColor,
	}));

	const pseudonymClasses = computed(() => ({
		'text-nowrap': true,
		'~text-label-small-min/label-small-max': true,
		'font-semibold': !displayName.value,
		[userColorClass.value]: props.chooseColor && !displayName.value,
	}));
</script>
