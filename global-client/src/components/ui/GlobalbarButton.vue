<template>
	<div
		class="bg-surface-base hover:bg-surface-elevated focus-visible:ring-accent-blue-interactive w-fit rounded-md p-100 outline-none hover:cursor-pointer focus-visible:ring-3"
		role="button"
		tabindex="0"
		@click="handleClick"
		@keydown.enter="handleClick"
		@keydown.space.prevent="handleClick"
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
	});

	const emit = defineEmits(['click']);

	function handleClick(event: Event) {
		emit('click', event);
	}
</script>
