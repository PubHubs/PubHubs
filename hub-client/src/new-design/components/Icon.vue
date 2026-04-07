<template>
	<div
		class="h-fit w-fit"
		:data-testid="id"
	>
		<svg
			v-bind="$attrs"
			fill="currentColor"
			:height="iconSizes[size]"
			:transform="displayMirrored"
			viewBox="0 0 256 256"
			:width="iconSizes[size]"
			xmlns="http://www.w3.org/2000/svg"
		>
			<slot />
			<!-- eslint-disable-next-line vue/no-v-html -- static SVG icon assets -->
			<g v-html="icons[displayType][weightType]" />
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

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Assets
	import { icons } from '@hub-client/assets/icons';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

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

	const logger = createLogger('Icon');

	// Computed
	const displayType = computed(() => {
		if (icons[props.type]) return props.type;
		logger.warn('[Icon] fallback icon', props.type);
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
