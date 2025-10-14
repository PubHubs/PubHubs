<template>
	<div class="flex h-fit w-fit shrink-0 items-center justify-center" :class="'w-[' + iconSizes[size] + 'px] h-[' + iconSizes[size] + 'px]'" :data-testid="type">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" :width="iconSizes[size]" :height="iconSizes[size]" fill="currentColor" :transform="displayMirrored" v-bind="$attrs">
			<slot></slot>
			<g v-html="icons[type][weight]"></g>
		</svg>
	</div>
</template>

<script lang="ts" setup>
	import { computed, PropType } from 'vue';
	import { icons, iconSizes } from '@/assets/icons';

	const props = defineProps({
		type: {
			type: String,
			default: 'x',
			validator(value: string) {
				return Object.keys(icons).includes(value);
			},
		},
		size: {
			type: [String, Number],
			default: 'base',
			validator(value: string) {
				return Object.keys(iconSizes).includes(value);
			},
		},
		weight: {
			type: String as PropType<'default' | 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'>,
			default: 'default',
		},
		mirrored: {
			type: Boolean,
		},
	});

	const displayMirrored = computed(() => (props.mirrored ? 'scale(-1, 1)' : undefined));
</script>
