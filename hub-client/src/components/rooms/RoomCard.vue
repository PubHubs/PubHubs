<template>
	<div class="max-w-80 flex h-44 min-w-44 flex-col overflow-hidden rounded-md">
		<div class="h-1/2">
			<ImagePlaceholder :src="image" />
		</div>
		<div class="bg-hub-background-3 text-hub-text relative flex">
			<div class="bg-hub-accent absolute -top-4 flex w-fit rounded-r-md px-4 py-1">
				<Icon type="speech_bubbles" size="sm" class="text-black" />
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="flex flex-col p-4">
				<H3 class="~text-body-min/body-max font-semibold"><slot name="header"></slot></H3>
				<div class="flex flex-row justify-between gap-x-8 pb-1">
					<p class="font-normal ~text-label-min/label-max"><slot name="content"></slot></p>
					<button class="bg-blue-light hover:bg-blue self-end rounded-sm text-white focus:outline-none focus:ring-2 focus:ring-opacity-75"><Icon type="arrow-right" /></button>
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
