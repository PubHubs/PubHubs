<template>
	<div class="bg-surface-base" :class="direction === 'horizontal' ? 'h-px w-full' : 'h-full w-px'">
		<slot></slot>
	</div>
</template>

<script lang="ts">
	// Types
	export type TDirection = 'horizontal' | 'vertical';
</script>

<script setup lang="ts">
	// Props
	withDefaults(
		defineProps<{
			direction?: TDirection;
		}>(),
		{
			direction: 'horizontal',
		},
	);
</script>
