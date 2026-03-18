<template>
	<div :class="[colorClass[props.color], sizeClass[props.size]]" class="text-label-small relative flex items-center justify-center overflow-hidden rounded-full font-bold">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	const colorClass: { [key: string]: string } = {
		ph: 'bg-accent-primary text-on-accent-primary',
		hub: 'bg-accent-primary text-on-accent-primary',
		notification: 'bg-on-surface-variant text-on-accent-primary dark:text-surface-high',
	};

	const sizeClass: { [key: string]: string } = {
		default: 'h-6 w-6',
		sm: 'h-2 w-2',
		md: 'h-3 w-3',
		lg: 'h-4 w-4',
	};

	const props = defineProps({
		color: {
			type: String,
			default: 'hub',
		},
		size: {
			type: String,
			default: 'default',
		},
	});
</script>
