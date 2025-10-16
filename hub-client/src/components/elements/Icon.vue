<template>
	<div class="flex h-fit w-fit shrink-0 items-center justify-center" :data-testid="type">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" :width="iconSizes[size]" :height="iconSizes[size]" fill="currentColor" :transform="displayMirrored" v-bind="$attrs">
			<slot></slot>
			<g v-html="icons[displayType][weightType]"></g>
		</svg>
	</div>
</template>

<script lang="ts" setup>
	import { computed, PropType } from 'vue';
	import { iconSizes } from '@/assets/sizes';
	import { icons } from '@/assets/icons';

	const props = defineProps({
		type: {
			type: String,
			default: 'selection',
		},
		size: {
			type: [String, Number],
			default: 'base',
		},
		weight: {
			type: String as PropType<'default' | 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'>,
			default: 'default',
		},
		mirrored: {
			type: Boolean,
			default: false,
		},
	});

	const displayType = computed(() => {
		if (icons[props.type]) {
			return props.type;
		}
		return 'selection'; // dotted square
	});

	const weightType = computed(() => {
		let weight = props.weight as string;
		if (icons[props.type][weight]) {
			return weight;
		}
		// fallback: get first weight type
		weight = Object.keys(icons[props.type])[0];
		if (icons[props.type][weight]) {
			return weight;
		}
		return '';
	});

	const displayMirrored = computed(() => (props.mirrored ? 'scale(-1, 1)' : undefined));
</script>
