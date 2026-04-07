<template>
	<span
		class="text-label-tiny text-on-surface rounded-base px-075 py-025 pt-025 flex items-center justify-center gap-2 border uppercase"
		:class="badgeClasses"
		data-testid="event-badges"
		:title="badgeLabel"
	>
		<slot class="line-clamp-1 truncate" />
	</span>
</template>

<script lang="ts" setup>
	withDefaults(
		defineProps<{
			badgeClasses?: string | string[] | Record<string, boolean>;
			badgeLabel?: string;
		}>(),
		{
			badgeClasses: '',
			badgeLabel: '',
		},
	);
</script>
