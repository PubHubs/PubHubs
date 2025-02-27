<template>
	<div class="z-10 flex h-full flex-col overflow-hidden">
		<div :class="headerClass" class="relative flex flex-1 flex-col justify-center">
			<slot name="header"></slot>
		</div>
		<div class="scrollbar relative flex-1 overflow-y-auto">
			<slot></slot>
		</div>
		<div>
			<slot name="footer"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { headerSizes } from '@/assets/sizes';
	import { computed } from 'vue';

	const props = defineProps({
		headerSize: {
			type: String,
			default: 'base',
		},
		headerBgColor: {
			type: String,
			default: 'bg-hub-background-2',
		},
		headerMobilePadding: {
			type: Boolean,
			default: false,
		},
	});

	const headerClass = computed(() => {
		let c = headerSizes[props.headerSize] + ' ' + props.headerBgColor;

		if (props.headerMobilePadding) {
			c += ' md:px-6 md:pt-4 pl-20 ';
		} else {
			c += ' px-6 pt-4 ';
		}
		return c;
	});
</script>
