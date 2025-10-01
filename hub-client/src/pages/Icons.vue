<template>
	<div class="p-4">
		<H1>Icons</H1>

		<div class="mb-4 flex gap-2">
			<Button v-for="(size, key) in sizes" @click="setSize(key)" size="sm">{{ key }}</Button>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div v-for="(icon, key) in icons" class="h-36 w-32 place-content-center bg-surface-subtle text-center">
				<Icon :type="key" class="m-auto bg-surface" :title="key" :size="size"></Icon>
				<div class="text-nowrap pt-2 text-sm">{{ key }}</div>
			</div>
		</div>

		<!-- <div class="mt-4 grid grid-cols-10 border-b font-bold">
			<div class="border-r">Type</div>
			<div v-for="(size, key) in sizes" class="text-center">{{ key }}</div>
		</div>
		<div v-for="(icon, key) in icons" class="mt-4 grid grid-cols-10 items-center">
			<div class="text-nowrap border-r">{{ key }}</div>
			<div v-for="(size, keysize) in sizes"><Icon :type="key" :size="keysize" class="m-auto bg-surface"></Icon></div>
		</div> -->
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { icons, sizes } from '@/assets/icons';

	const size = ref('base');

	const setSize = (s: string) => {
		size.value = s;
	};
</script>
