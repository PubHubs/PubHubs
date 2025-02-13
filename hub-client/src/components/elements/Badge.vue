<template>
	<div :class="colorClass[props.color]" class="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-sm font-bold">
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
