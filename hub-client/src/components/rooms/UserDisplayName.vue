<template>
	<span class="flex flex-row gap-x-2 items-start" :title="displayName">
		<span v-if="displayName" data-testid="display-name" :class="`${textColor(color(user))} font-semibold text-sm`">{{ filters.maxLengthText(displayName, settings.getDisplayNameMaxLength) }}</span>
		<span class="text-xs text-nowrap font-normal" style="margin-top: 3px">{{ filters.extractPseudonym(user) }}</span>
	</span>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/composables/useUserColor';
	import filters from '@/core/filters';
	import { computed } from 'vue';

	import Room from '@/model/rooms/Room';
	import { useSettings } from '@/store/settings';
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
