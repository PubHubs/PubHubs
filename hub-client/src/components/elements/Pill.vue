<template>
	<div class="bg-white-middle dark:bg-gray flex flex-row overflow-hidden rounded-md text-black dark:text-white">
		<div class="bg-blue-light w-3" />
		<div class="mt-1 flex flex-col px-4 pb-1">
			<H3 class="text-body font-semibold">
				<slot name="header" />
			</H3>
			<p class="text-label font-normal">
				<slot name="content" />
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
</script>
