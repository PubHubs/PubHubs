<template>
	<div
		class="hover:bg-surface-elevated rounded-base p-100 hover:cursor-pointer"
		:class="selected ? 'bg-surface-elevated' : 'bg-surface-base'"
		role="button"
		@click="handleClick"
	>
		<Icon
			:size="size"
			:type="type"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
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
