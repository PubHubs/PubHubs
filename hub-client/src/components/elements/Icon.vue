<template>
	<div class="flex h-fit w-fit shrink-0 items-center justify-center">
		<button v-if="asButton" :class="['flex items-center justify-center', iconColor]">
			<svg viewBox="0 0 24 24" fill="transparent" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" :class="sizes[size]" v-html="icons[type]"></svg>
		</button>
		<svg v-else viewBox="0 0 24 24" fill="transparent" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" :class="sizes[size]" v-html="icons[type]"></svg>
	</div>
</template>

<script setup lang="ts">
	import { icons, sizes } from '@/assets/icons';
	import { computed } from 'vue';

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
		asButton: {
			type: Boolean,
			default: false,
		},
		iconColor: {
			type: String,
			default: 'text-on-surface',
		},
		// Added for polling
		filled: {
			type: Boolean,
			default: false,
		},
	});

	const strokeWidth = computed(() => {
		if (props.filled) {
			return 0;
		}
		return 2;
	});
</script>
