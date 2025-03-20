<template>
	<div :class="{ block: isTouchDevice, 'opacity-0 transition-all duration-75 ease-in-out group-hover:opacity-100': !isTouchDevice }">
		<div class="flex gap-1">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import device from '@/logic/core/device';
	const isTouchDevice = device.isTouchDevice();
</script>
