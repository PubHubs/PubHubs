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

<script lang="ts" setup>
	// Packages
	import { type PropType, computed } from 'vue';

	// Assets
	import { icons } from '@hub-client/assets/icons';
	import { iconSizes } from '@hub-client/assets/sizes';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

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
		testid: {
			type: String,
			default: '',
		},
	});

	const logger = createLogger('Icon');

	const displayType = computed(() => {
		if (icons[props.type]) {
			return props.type;
		}
		logger.warn('fallback icon', props.type);
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
