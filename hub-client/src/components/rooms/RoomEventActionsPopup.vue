<template>
	<div
		class="bg-surface fixed right-8 rounded-md"
		:class="{
			'hidden group-hover:block': !isTouchDevice && !remainActive,
			'bg-surface-base block': isTouchDevice || remainActive,
		}"
	>
		<div class="flex">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Logic
	import device from '@hub-client/logic/core/device';

	const isTouchDevice = device.isTouchDevice();

	const props = defineProps({
		remainActive: {
			type: Boolean,
			default: false,
		},
	});
</script>
