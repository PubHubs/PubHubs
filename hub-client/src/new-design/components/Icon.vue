<template>
	<div class="h-fit w-fit" :data-testid="id">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" :width="iconSize[size]" :height="iconSize[size]" fill="currentColor" :transform="displayMirrored" v-bind="$attrs">
			<slot></slot>
			<g v-html="icons[displayType][weightType]"></g>
		</svg>
	</div>
</template>

<script lang="ts">
	export enum iconSizeVariant {
		Small = 'sm',
		Base = 'base',
	}
	export type sVariant = keyof typeof iconSizeVariant;

	export const iconSize: { [key: string]: string } = {
		[iconSizeVariant.Small]: '16',
		[iconSizeVariant.Base]: '24',
	};
</script>

<script setup lang="ts">
	// Packages
	import { PropType, computed } from 'vue';

	import { iconTypes, icons } from '@hub-client/assets/icons';

	const props = defineProps({
		type: {
			type: String,
			default: 'selection',
			validator(value: string) {
				return Object.values(iconTypes).includes(value);
			},
		},
		size: {
			type: String,
			default: iconSizeVariant.Base,
			validator(value: iconSizeVariant) {
				return Object.values(iconSizeVariant).includes(value);
			},
		},
		weight: {
			type: String as PropType<'default' | 'regular' | 'fill'>,
			default: 'default',
		},
		mirrored: {
			type: Boolean,
			default: false,
		},
		testid: {
			type: String,
			default: '',
		},
	});

	const displayType = computed(() => {
		if (icons[props.type]) {
			return props.type;
		}
		console.log('fallback icon', props.type);
		return 'selection'; // dotted square
	});

	const weightType = computed(() => {
		let weight = props.weight as string;
		if (icons[displayType.value][weight]) {
			return weight;
		}
		weight = Object.keys(icons[displayType.value])[0];
		if (icons[displayType.value][weight]) {
			return weight;
		}
		return '';
	});

	const id = computed(() => {
		if (props.testid) return props.testid;
		return props.type;
	});

	const displayMirrored = computed(() => (props.mirrored ? 'scale(-1, 1)' : undefined));
</script>
