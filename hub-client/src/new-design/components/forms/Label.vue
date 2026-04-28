<template>
	<label
		class="text-label-small gap-050 text-on-surface inline-flex w-full items-start justify-start"
		:for="id"
	>
		<slot />
		<span
			v-if="required"
			aria-hidden="true"
			class="text-accent-red"
			>*</span
		>
	</label>
</template>

<script lang="ts" setup>
	// Packages
	import { inject } from 'vue';

	// Injected
	const id = inject('id', '') as string;
	const required = inject('required', false) as boolean;
</script>
