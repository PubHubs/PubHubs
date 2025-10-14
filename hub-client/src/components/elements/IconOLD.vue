<template>
	<div class="flex h-fit w-fit shrink-0 items-center justify-center" :data-testid="type">
		<svg viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" :class="sizes[size]" v-html="icons[type]"></svg>
	</div>
</template>

<script setup lang="ts">
	import { icons, sizes } from '@/assets/icons';

	const props = defineProps({
		type: {
			type: String,
			default: 'empty',
			validator(value: string) {
				return Object.keys(icons).includes(value);
			},
		},
		size: {
			type: String,
			default: 'base',
			validator(value: string) {
				return Object.keys(sizes).includes(value);
			},
		},
	});
</script>
