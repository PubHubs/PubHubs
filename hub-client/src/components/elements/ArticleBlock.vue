<template>
	<div class="flex flex-col h-44 w-full">
		<ImagePlaceholder :src="image" class="rounded-t-md overflow-hidden"></ImagePlaceholder>
		<div class="rounded-b-md bg-white-middle text-hub-text dark:bg-gray">
			<div class="w-fit flex -mt-6 py-1 px-4 rounded-r-md bg-blue-light">
				<Icon type="speech_bubbles" size="sm" class="text-black"></Icon>
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="flex flex-col px-4 pb-1 mt-1">
				<H3 class="font-semibold text-base"><slot name="header"></slot></H3>
				<div class="flex flex-row justify-between gap-x-8 pb-1">
					<p class="font-normal text-xs"><slot name="content"></slot></p>
					<button class="bg-blue-light text-white rounded-sm self-end focus:outline-none focus:ring-2 focus:ring-opacity-75 hover:bg-blue"><Icon type="arrow-right"></Icon></button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import ImagePlaceholder from './ImagePlaceholder.vue';
	import Icon from './Icon.vue';
	import H3 from './H3.vue';

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
