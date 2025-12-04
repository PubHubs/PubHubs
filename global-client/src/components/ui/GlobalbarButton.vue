<template>
	<div class="bg-background hover:bg-on-surface-variant hover:text-background rounded-md p-2 hover:cursor-pointer" @click="handleClick">
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
	});

	const emit = defineEmits(['click']);

	function handleClick(event: Event) {
		emit('click', event);
	}
</script>
