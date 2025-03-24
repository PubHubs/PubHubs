<template>
	<Icon
		:type="type"
		class="rounded-md bg-background p-1 text-accent-secondary hover:cursor-pointer hover:bg-accent-secondary hover:text-background dark:text-on-surface dark:hover:bg-on-surface dark:hover:text-background"
		:size="size"
		@click="handleClick"
	/>
</template>

<script setup lang="ts">
	// Package imports
	import { defineProps, defineEmits } from 'vue';

	// Global imports
	import Icon from '@/../../hub-client/src/components/elements/Icon.vue';

	const props = defineProps({
		type: {
			type: String,
			required: true,
		},
		size: {
			type: String,
			default: 'base',
		},
	});

	const emit = defineEmits(['click']);

	function handleClick(event: Event) {
		emit('click', event);
	}
</script>
