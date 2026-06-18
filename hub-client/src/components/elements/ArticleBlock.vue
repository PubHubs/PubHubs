<template>
	<div class="flex h-2000 w-full flex-col">
		<ImagePlaceholder
			class="overflow-hidden rounded-t-md"
			:src="image"
		/>
		<div class="bg-white-middle text-hub-text dark:bg-gray rounded-b-md">
			<div class="bg-blue-light py-050 -mt-300 flex w-fit rounded-r-md px-200">
				<Icon
					class="text-black"
					size="sm"
					type="chats-circle"
				/>
				<p class="pl-100 text-white">
					<slot name="category" />
				</p>
			</div>
			<div class="mt-050 pb-050 flex flex-col px-200">
				<H3 class="text-body font-semibold">
					<slot name="header" />
				</H3>
				<div class="pb-050 flex flex-row justify-between gap-x-400">
					<p class="text-label font-normal">
						<slot name="content" />
					</p>
					<button class="bg-blue-light hover:bg-blue focus:ring-opacity-75 self-end rounded-xs text-white focus:ring-2 focus:outline-none">
						<Icon type="arrow-right" />
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import ImagePlaceholder from '@hub-client/components/elements/ImagePlaceholder.vue';

	defineProps({
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
