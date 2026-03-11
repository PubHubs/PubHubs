<template>
	<div class="h-fit w-fit" :data-testid="id">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" :width="iconSizes[size]" :height="iconSizes[size]" fill="currentColor" :transform="displayMirrored" v-bind="$attrs">
			<slot></slot>
			<g v-html="icons[displayType][weightType]"></g>
		</svg>
	</div>
</template>

<script lang="ts">
	// Sizes
	const iconSizes = {
		sm: '16',
		base: '24',
	} as const;
	export type TSize = keyof typeof iconSizes;
</script>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Assets
	import { icons } from '@hub-client/assets/icons';

	// Props
	const props = withDefaults(
		defineProps<{
			mirrored?: boolean;
			size?: TSize;
			testid?: string;
			type?: string;
			weight?: 'default' | 'regular' | 'fill';
		}>(),
		{
			mirrored: false,
			size: 'base',
			testid: '',
			type: 'selection',
			weight: 'default',
		},
	);

	// Computed
	const displayType = computed(() => {
		if (icons[props.type]) return props.type;
		console.warn('[Icon] fallback icon', props.type);
		return 'selection';
	});

	const weightType = computed(() => {
		if (icons[displayType.value][props.weight]) return props.weight;
		const fallback = Object.keys(icons[displayType.value])[0];
		if (icons[displayType.value][fallback]) return fallback;
		return '';
	});

	const id = computed(() => props.testid || props.type);

	const displayMirrored = computed(() => (props.mirrored ? 'scale(-1, 1)' : undefined));
</script>
