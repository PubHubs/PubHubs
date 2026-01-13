<template>
	<label class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start">
		<slot></slot>
		<span v-if="required" class="text-accent-red" aria-hidden="true">*</span>
	</label>
</template>

<script setup lang="ts">
	// Props
	const props = withDefaults(
		defineProps<{
			required?: boolean;
		}>(),
		{
			required: false,
		},
	);
</script>
