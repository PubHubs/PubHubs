<template>
	<div class="hover:bg-on-surface-variant hover:text-background rounded-base p-2 hover:cursor-pointer" :class="selected ? 'bg-surface-high' : 'bg-background'" @click="handleClick" role="button">
		<Icon :type="type" :size="size" />
	</div>
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
