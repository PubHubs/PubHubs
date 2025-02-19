<template>
	<div class="flex flex-row overflow-hidden rounded-md bg-white-middle text-black dark:bg-gray dark:text-white">
		<div class="w-3 bg-blue-light"></div>
		<div class="mt-1 flex flex-col px-4 pb-1">
			<H3 class="text-base font-semibold"><slot name="header"></slot></H3>
			<p class="text-xs font-normal"><slot name="content"></slot></p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import H3 from './H3.vue';
</script>
