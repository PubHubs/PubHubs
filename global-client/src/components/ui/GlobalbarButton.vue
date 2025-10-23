<template>
	<div class="rounded-md p-2 hover:cursor-pointer hover:bg-on-surface-variant hover:text-background bg-background" @click="handleClick">
		<Icon :type="type" :size="size" />
	</div>
</template>

<script setup lang="ts">
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
