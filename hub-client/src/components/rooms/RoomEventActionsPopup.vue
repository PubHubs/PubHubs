<template>
	<div :class="{ block: isTouchDevice, 'hidden group-hover:block': !isTouchDevice }">
		<div class="flex gap-1">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import device from '@/logic/core/device';
	const isTouchDevice = device.isTouchDevice();
</script>
