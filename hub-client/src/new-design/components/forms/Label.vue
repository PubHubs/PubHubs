<template>
	<label :for="id" class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start">
		<slot></slot>
		<span v-if="required" class="text-accent-red" aria-hidden="true">*</span>
	</label>
</template>

<script setup lang="ts">
	import { inject } from 'vue';

	const id = inject('id') as string;
	const required = inject('required') as boolean;

	// Props
	const props = withDefaults(
		defineProps<{
			for?: string;
			required?: boolean;
		}>(),
		{
			for: '',
			required: false,
		},
	);
</script>
