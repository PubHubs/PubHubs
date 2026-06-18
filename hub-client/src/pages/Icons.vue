<template>
	<div class="p-200">
		<H1 class="mb-200">Icons</H1>
		<div class="mb-200 flex gap-100">
			<Button
				v-for="(s, key) in iconSizes"
				:key="key"
				size="sm"
				:color="size === key ? 'red' : 'primary'"
				@click="setSize(String(key))"
				>{{ key }}</Button
			>
		</div>
		<div class="mb-200">
			<input
				v-model="search"
				type="text"
				placeholder="Search icons..."
				class="border-surface bg-surface focus:ring-accent-primary py-020 w-3000 rounded border px-150 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap items-center gap-200">
			<div
				v-for="(_, key) in filteredIcons"
				:key="key"
				class="bg-surface h-2000 w-2000 place-content-center text-center"
			>
				<Icon
					:type="key as string"
					:size="size"
					class="bg-surface hover:bg-accent-primary m-auto cursor-pointer"
					:title="key"
				></Icon>
				<TruncatedText class="pt-100 text-sm text-nowrap">{{ key }}</TruncatedText>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';

	import { icons } from '@hub-client/assets/icons';
	import { iconSizes } from '@hub-client/assets/sizes';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';

	const size = ref('lg');
	const search = ref('');

	const setSize = (s: string) => {
		size.value = s;
	};

	const filteredIcons = computed(() => {
		if (!search.value) return icons;
		const q = search.value.toLowerCase();
		return Object.fromEntries(Object.entries(icons).filter(([key]) => key.toLowerCase().includes(q)));
	});
</script>
