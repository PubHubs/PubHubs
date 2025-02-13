<template>
	<span class="flex flex-row items-start gap-x-2" :title="displayName">
		<span v-if="displayName" data-testid="display-name" :class="`${textColor(color(user))} text-sm font-semibold`">{{ filters.maxLengthText(displayName, settings.getDisplayNameMaxLength) }}</span>
		<span class="text-nowrap text-xs font-normal" style="margin-top: 3px">{{ filters.extractPseudonym(user) }}</span>
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
