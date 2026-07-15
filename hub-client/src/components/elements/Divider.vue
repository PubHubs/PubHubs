<template>
	<div
		class="bg-on-surface-disabled/50"
		:class="direction === 'horizontal' ? 'h-025 my-100 w-full' : 'w-025 mx-100 h-full'"
	>
		<slot />
	</div>
</template>

<script lang="ts">
	// Types
	export type TDirection = 'horizontal' | 'vertical';
</script>

<script lang="ts" setup>
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
