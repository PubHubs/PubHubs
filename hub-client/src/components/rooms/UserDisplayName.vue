<template>
	<span class="flex flex-row items-center gap-x-2 truncate" :title="displayName">
		<span v-if="displayName" data-testid="display-name" :class="`${textColor(color(user))} truncate font-semibold ~text-label-min/label-max`">{{ filters.maxLengthText(displayName, settings.getDisplayNameMaxLength) }}</span>
		<span :class="`${!displayName && 'font-semibold'} text-nowrap ~text-label-small-min/label-small-max`">{{ filters.extractPseudonym(user) }}</span>
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

	const props = defineProps({
		user: {
			type: String,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	const displayName = computed(() => {
		const member = props.room.getMember(props.user);
		// If the display name is not set, we get user Id. In that case return empty display name.
		if (props.user === member?.rawDisplayName || filters.extractPseudonym(props.user) === member?.rawDisplayName) return '';
		// Conditionally renders displayName
		return member?.rawDisplayName;
	});
</script>
