<template>
	<button class="flex items-center justify-center">
		<Icon :type="type" :size="size" :weight="weight" :mirrored="mirrored"></Icon>
	</button>
</template>

<script setup lang="ts">
	import { PropType } from 'vue';
	import { iconSizes } from '@/assets/sizes';
	import { icons } from '@/assets/icons';

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
</script>
