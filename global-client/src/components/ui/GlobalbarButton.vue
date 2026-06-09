<template>
	<div
		class="bg-surface-base hover:bg-surface-elevated w-fit rounded-md p-2 hover:cursor-pointer"
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
	});

	const emit = defineEmits(['click']);

	function handleClick(event: Event) {
		emit('click', event);
	}
</script>
