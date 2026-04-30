<template>
	<Button
		class="m-2"
		:class="isStartButton ? '' : 'animate-pulse'"
		:variant="isStartButton ? 'primary' : 'error'"
		icon="video"
		:title="isStartButton ? 'Start call' : 'Join call'"
	>
		<span v-if="!isStartButton">Join</span>
	</Button>
</template>

<script setup lang="ts">
	import Button from '@hub-client/new-design/components/Button.vue';

	defineProps({
		isStartButton: {
			type: Boolean,
			default: false,
		},
	});
</script>
