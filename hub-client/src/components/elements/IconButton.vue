<template>
	<button class="bg-surface-high flex items-center justify-center rounded-md p-1">
		<Icon
			:mirrored="mirrored"
			:size="size"
			:type="type"
			:weight="weight"
		/>
	</button>
</template>

<script lang="ts" setup>
	import { type PropType } from 'vue';

	defineProps({
		type: {
			type: String,
			default: 'empty',
		},
		size: {
			type: String,
			default: 'base',
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
