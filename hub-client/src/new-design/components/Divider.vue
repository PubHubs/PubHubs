<template>
	<div class="bg-surface-base" :class="[direction == 'horizontal' ? `h-[${stroke}px] w-full` : `w-[${stroke}px] h-full`]">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	const props = withDefaults(
		defineProps<{
			direction: 'horizontal' | 'vertical';
			stroke?: number;
		}>(),
		{
			direction: 'horizontal',
			stroke: 1,
		},
	);

	const { direction, stroke } = props;
</script>
