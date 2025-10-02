<template>
	<div class="p-4">
		<H1>Icons</H1>

		<H2>PhIcons</H2>

		<div class="mb-4 flex gap-2">
			<Button v-for="(size, key) in PHiconSizes" @click="setPHSize(key)" size="sm">{{ key }}</Button>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div v-for="(icon, key) in phicons" class="h-36 w-32 place-content-center bg-surface-subtle text-center">
				<PhIcon :type="key" :size="PHsize" class="m-auto bg-surface" :title="key" :mirrored="true"></PhIcon>
				<div class="text-nowrap pt-2 text-sm">{{ key }}</div>
			</div>
		</div>

		<hr class="my-20"></hr>

		<H2>Old Icons</H2>

		<div class="mb-4 flex gap-2">
			<Button v-for="(size, key) in sizes" @click="setSize(key)" size="sm">{{ key }}</Button>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<div v-for="(icon, key) in icons" class="h-36 w-32 place-content-center bg-surface-subtle text-center">
				<Icon :type="key" class="m-auto bg-surface" :title="key" :size="size"></Icon>
				<div class="text-nowrap pt-2 text-sm">{{ key }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { phicons, icons, PHiconSizes, sizes } from '@/assets/icons';

	const size = ref('base');
	const PHsize = ref('base');

	const setSize = (s: string) => {
		size.value = s;
	};

	const setPHSize = (s: string) => {
		PHsize.value = s;
	};

</script>
