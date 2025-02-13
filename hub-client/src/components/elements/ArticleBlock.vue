<template>
	<div class="flex h-44 w-full flex-col">
		<ImagePlaceholder :src="image" class="overflow-hidden rounded-t-md"></ImagePlaceholder>
		<div class="rounded-b-md bg-white-middle text-hub-text dark:bg-gray">
			<div class="-mt-6 flex w-fit rounded-r-md bg-blue-light px-4 py-1">
				<Icon type="speech_bubbles" size="sm" class="text-black"></Icon>
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="mt-1 flex flex-col px-4 pb-1">
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
