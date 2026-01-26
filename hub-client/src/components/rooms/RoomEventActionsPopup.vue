<template>
	<div
		class="bg-surface rounded-md"
		:class="{
			block: isTouchDevice || remainActive,
			'hidden group-hover:block': !isTouchDevice && !remainActive,
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
