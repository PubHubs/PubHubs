<template>
	<div :class="colorClass[props.color]" class="flex relative items-center justify-center overflow-hidden rounded-full w-7 h-7 text-sm font-bold">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	const colorClass: { [key: string]: string } = {
		ph: 'bg-notification text-white',
		hub: 'bg-notification text-white',
	};

	const props = defineProps({
		color: {
			type: String,
			default: 'hub',
		},
	});
</script>
