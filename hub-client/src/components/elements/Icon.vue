<template>
	<button v-if="asButton">
		<svg viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" :class="sizes[size]" v-html="icons[type]"></svg>
	</button>
	<svg v-else viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" :class="sizes[size]" v-html="icons[type]"></svg>
</template>

<script setup lang="ts">
	import { icons, sizes } from '@/assets/icons';

	defineProps({
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
		asButton: {
			type: Boolean,
			default: false,
		},
	});
</script>
