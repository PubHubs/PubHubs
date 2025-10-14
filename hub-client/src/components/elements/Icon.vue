<template>
	<div class="flex h-fit w-fit shrink-0 items-center justify-center" :class="'w-[' + PHiconSizes[size] + 'px] h-[' + PHiconSizes[size] + 'px]'" :data-testid="type">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" :width="PHiconSizes[size]" :height="PHiconSizes[size]" fill="currentColor" :transform="displayMirrored" v-bind="$attrs">
			<slot></slot>
			<g v-html="phicons[type][weight]"></g>
		</svg>
	</div>
</template>

<script lang="ts" setup>
	import { computed, PropType } from 'vue';
	import { phicons, PHiconSizes } from '@/assets/icons';

	const props = defineProps({
		type: {
			type: String,
			default: 'x',
			validator(value: string) {
				return Object.keys(phicons).includes(value);
			},
		},
		size: {
			type: [String, Number],
			default: 'base',
			validator(value: string) {
				return Object.keys(PHiconSizes).includes(value);
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
