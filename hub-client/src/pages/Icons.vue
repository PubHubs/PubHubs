<template>
	<div class="p-4">
		<H1>Icons</H1>

		<div class="mb-4 flex gap-2">
			<Button v-for="(s, key) in iconSizes" @click="setSize(key)" size="sm" :color="size === key ? 'red' : 'primary'">{{ key }}</Button>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div v-for="(icon, key) in icons" class="h-36 w-32 place-content-center bg-surface-subtle text-center">
				<Icon :type="key" :size="size" class="m-auto cursor-pointer bg-surface hover:bg-accent-primary" :title="key"></Icon>
				<div class="text-nowrap pt-2 text-sm">{{ key }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { icons } from '@/assets/icons';
	import { iconSizes } from '@/assets/sizes';
	import { ref } from 'vue';

	const size = ref('base');

	const setSize = (s: string) => {
		size.value = s;
	};
</script>
