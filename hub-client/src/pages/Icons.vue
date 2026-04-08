<template>
	<div class="p-4">
		<H1 class="mb-4">Icons</H1>
		<div class="mb-4 flex gap-2">
			<Button
				v-for="(s, key) in iconSizes"
				:key="key"
				size="sm"
				:color="size === key ? 'red' : 'primary'"
				@click="setSize(String(key))"
				>{{ key }}</Button
			>
		</div>
		<div class="mb-4">
			<input
				v-model="search"
				type="text"
				placeholder="Search icons..."
				class="border-surface bg-surface-subtle focus:ring-accent-primary w-64 rounded border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap items-center gap-4">
			<div
				v-for="(_, key) in filteredIcons"
				:key="key"
				class="bg-surface-subtle h-36 w-32 place-content-center text-center"
			>
				<Icon
					:type="key"
					:size="size"
					class="bg-surface hover:bg-accent-primary m-auto cursor-pointer"
					:title="key"
				></Icon>
				<TruncatedText class="pt-2 text-sm text-nowrap">{{ key }}</TruncatedText>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';

	import { icons } from '@hub-client/assets/icons';
	import { iconSizes } from '@hub-client/assets/sizes';

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
