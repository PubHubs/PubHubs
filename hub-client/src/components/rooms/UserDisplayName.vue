<template>
	<span class="flex flex-row gap-x-2 items-center text-nowrap">
		<span v-if="displayName" data-testid="display-name" :class="`${textColor(color(user))} font-semibold text-sm`">{{ filters.maxLengthText(displayName, settings.getDisplayNameMaxLength) }}</span>
		<span class="text-xs font-normal">{{ filters.extractPseudonym(user) }}</span>
	</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import filters from '@/core/filters';
	import { useSettings } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';

	import Room from '@/model/rooms/Room';
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
