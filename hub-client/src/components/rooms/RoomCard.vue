<template>
	<div class="flex h-44 min-w-44 max-w-80 flex-col overflow-hidden rounded-md">
		<div class="h-1/2">
			<ImagePlaceholder :src="image"></ImagePlaceholder>
		</div>
		<div class="relative flex bg-hub-background-3 text-hub-text">
			<div class="absolute -top-4 flex w-fit rounded-r-md bg-hub-accent px-4 py-1">
				<Icon type="speech_bubbles" size="sm" class="text-black"></Icon>
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="flex flex-col p-4">
				<H3 class="text-base font-semibold"><slot name="header"></slot></H3>
				<div class="flex flex-row justify-between gap-x-8 pb-1">
					<p class="text-xs font-normal"><slot name="content"></slot></p>
					<button class="self-end rounded-sm bg-blue-light text-white hover:bg-blue focus:outline-none focus:ring-2 focus:ring-opacity-75"><Icon type="arrow-right"></Icon></button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import ImagePlaceholder from '../elements/ImagePlaceholder.vue';
	import Icon from '../elements/Icon.vue';
	import H3 from '../elements/H3.vue';

	const props = defineProps({
		image: {
			type: String,
			default: 'img/imageplaceholder.jpg',
		},
		to: {
			type: Object,
			default: null,
		},
	});
</script>
