<template>
	<div
		:class="{
			block: isTouchDevice || remainActive,
			'hidden group-hover:block': !isTouchDevice && !remainActive,
		}"
	>
		<div class="flex gap-1">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Logic
	import device from '@hub-client/logic/core/device';

	const props = defineProps({
		remainActive: {
			type: Boolean,
			default: false,
		},
	});

	const isTouchDevice = device.isTouchDevice();
</script>
