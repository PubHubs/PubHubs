<template>
	<Icon
		:type="type"
		class="rounded-md p-2 text-accent-secondary hover:cursor-pointer hover:bg-on-surface-variant hover:text-background dark:text-on-surface"
		:class="selected ? 'bg-surface-high' : 'bg-background'"
		:size="size"
		@click="handleClick"
	/>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const props = defineProps({
		type: {
			type: String,
			required: true,
		},
		size: {
			type: String,
			default: 'base',
		},
		selected: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(['click']);

	function handleClick(event: Event) {
		emit('click', event);
	}
</script>
