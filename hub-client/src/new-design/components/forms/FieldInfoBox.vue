<template>
	<div class="pt-050 flex w-full items-baseline gap-100">
		<div class="grow">
			<slot></slot>
		</div>
		<div v-if="info" class="text-on-surface-dim text-label-small flex-none whitespace-nowrap">
			{{ info }}
		</div>
	</div>
</template>

<script setup lang="ts">
	// Props
	const props = withDefaults(
		defineProps<{
			info?: string | boolean;
		}>(),
		{
			info: false,
		},
	);
</script>
