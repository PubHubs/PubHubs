<template>
	<div
		class="text-label-small relative flex items-center justify-center overflow-hidden rounded-full font-bold"
		:class="[colorClass[props.color], sizeClass[props.size]]"
	>
		<slot />
	</div>
</template>

<script lang="ts" setup>
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

	const colorClass: { [key: string]: string } = {
		ph: 'bg-accent-primary text-on-accent-primary',
		hub: 'bg-accent-primary text-on-accent-primary',
		unknown: 'bg-on-surface-disabled',
	};

	const sizeClass: { [key: string]: string } = {
		default: 'h-300 w-300',
		sm: 'h-100 w-100',
		md: 'h-150 w-150',
		lg: 'h-200 w-200',
	};
</script>
