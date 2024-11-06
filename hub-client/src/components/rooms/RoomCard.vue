<template>
	<div class="flex flex-col h-44 max-w-80 min-w-44 overflow-hidden rounded-md">
		<div class="h-1/2">
			<ImagePlaceholder :src="image"></ImagePlaceholder>
		</div>
		<div class="relative flex text-hub-text bg-hub-background-3">
			<div class="w-fit flex absolute -top-4 py-1 px-4 rounded-r-md bg-hub-accent">
				<Icon type="speech_bubbles" size="sm" class="text-black"></Icon>
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="flex flex-col p-4">
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
