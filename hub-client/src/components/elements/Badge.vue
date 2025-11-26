<template>
	<div :class="colorClass[props.color]" class="text-label-small relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full font-bold">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	const colorClass: { [key: string]: string } = {
		ph: 'bg-accent-primary text-on-accent-primary',
		hub: 'bg-accent-primary text-on-accent-primary',
		notification: 'bg-on-surface-variant text-on-accent-primary dark:text-surface-high',
	};

	const props = defineProps({
		color: {
			type: String,
			default: 'hub',
		},
	});
</script>
