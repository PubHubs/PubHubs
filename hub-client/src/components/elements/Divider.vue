<template>
	<div
		class="bg-surface-base"
		:class="direction === 'horizontal' ? 'my-2 h-px w-full' : 'mx-2 h-full w-px'"
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
