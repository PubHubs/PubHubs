<template>
	<button class="flex items-center justify-center">
		<Icon :type="type" :size="size"></Icon>
	</button>
</template>

<script setup lang="ts">
	import { icons, sizes } from '@/assets/icons';

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
				return Object.keys(sizes).includes(value);
			},
		},
	});
</script>
