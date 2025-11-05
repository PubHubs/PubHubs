<template>
	<div class="flex h-44 w-full flex-col">
		<ImagePlaceholder :src="image" class="overflow-hidden rounded-t-md" />
		<div class="bg-white-middle text-hub-text dark:bg-gray rounded-b-md">
			<div class="bg-blue-light -mt-6 flex w-fit rounded-r-md px-4 py-1">
				<Icon type="chats-circle" size="sm" class="text-black" />
				<p class="pl-2 text-white"><slot name="category"></slot></p>
			</div>
			<div class="mt-1 flex flex-col px-4 pb-1">
				<H3 class="~text-body-min/body-max font-semibold"><slot name="header"></slot></H3>
				<div class="flex flex-row justify-between gap-x-8 pb-1">
					<p class="font-normal ~text-label-min/label-max"><slot name="content"></slot></p>
					<button class="bg-blue-light hover:bg-blue self-end rounded-sm text-white focus:outline-none focus:ring-2 focus:ring-opacity-75">
						<Icon type="arrow-right" />
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import ImagePlaceholder from '@hub-client/components/elements/ImagePlaceholder.vue';

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
