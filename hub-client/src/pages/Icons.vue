<template>
	<div class="p-4">
		<H1>Icons</H1>

		<div class="mb-4 flex gap-2">
			<Button v-for="(size, key) in iconSizes" @click="setSize(key)" size="sm">{{ key }}</Button>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div v-for="(icon, key) in icons" class="h-36 w-32 place-content-center bg-surface-subtle text-center">
				<Icon :type="key" :size="size" class="m-auto bg-surface" :title="key" :mirrored="true"></Icon>
				<div class="text-nowrap pt-2 text-sm">{{ key }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { iconSizes } from '@/assets/sizes';
	import { icons } from '@/assets/icons';

	const size = ref('base');

	const setSize = (s: string) => {
		size.value = s;
	};
</script>
