<template>
	<div class="p-4">
		<H1>Icons</H1>

		<div class="mt-4 grid grid-cols-10 border-b font-bold">
			<div class="border-r">Type</div>
			<div v-for="(size, key) in sizes" class="text-center">{{ key }}</div>
		</div>
		<div v-for="(icon, key) in icons" class="mt-4 grid grid-cols-10 items-center">
			<div class="text-nowrap border-r">{{ key }}</div>
			<div v-for="(size, keysize) in sizes"><Icon :type="key" :size="keysize" class="m-auto bg-surface"></Icon></div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { icons, sizes } from '@/assets/icons';
</script>
