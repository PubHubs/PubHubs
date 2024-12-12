<template>
	<div class="flex flex-col h-full overflow-hidden">
		<div :class="headerClass" class="flex flex-col flex-1 justify-center z-10 relative">
			<slot name="header"></slot>
		</div>
		<div class="flex-1 overflow-y-auto scrollbar">
			<slot></slot>
		</div>
		<div class="z-10">
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
