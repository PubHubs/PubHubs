<template>
	<div class="bg-white-middle dark:bg-gray flex flex-row overflow-hidden rounded-md text-black dark:text-white">
		<div class="bg-blue-light w-3"></div>
		<div class="mt-1 flex flex-col px-4 pb-1">
			<H3 class="~text-body-min/body-max font-semibold"><slot name="header"></slot></H3>
			<p class="font-normal ~text-label-min/label-max"><slot name="content"></slot></p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import H3 from './H3.vue';
</script>
