<template>
	<button class="bg-surface-high flex items-center justify-center rounded-md p-1">
		<Icon :type="type" :size="size" :weight="weight" :mirrored="mirrored"></Icon>
	</button>
</template>

<script setup lang="ts">
	import { PropType } from 'vue';

	const props = defineProps({
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
