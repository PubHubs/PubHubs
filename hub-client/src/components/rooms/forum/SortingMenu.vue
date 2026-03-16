<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" @click.self="sortingStore.closeMenu()">
		<div class="border-accent-primary bg-accent-secondary relative w-80 rounded-lg border-2 shadow-xl">
			<div class="relative border-b p-4">
				<Icon class="text-accent-primary absolute top-4 right-4 transition-transform duration-200 hover:scale-125" @click="sortingStore.closeMenu()" as-button type="close_menu" size="base" />
				<h3 class="text-lg font-medium">Sort by</h3>
			</div>

			<!-- Sorting options -->
			<div class="divide-y">
				<button v-for="option in sortOptions" :key="option.key" class="hover:bg-surface-low flex w-full items-center justify-between px-4 py-3 transition-colors" @click="sortingStore.toggleOption(option.key)">
					<div class="flex items-center space-x-3">
						<Icon :type="option.icon" size="base" class="text-accent-primary" />
						<span>{{ option.label }}</span>
					</div>
					<Icon :type="sortingStore.getDirectionIcon(option.key)" size="base" class="text-accent-primary" />
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useSortingStore } from '@hub-client/stores/forum/sortingStore';
	import { sortOptions } from '@hub-client/stores/forum/sortingStore';

	const sortingStore = useSortingStore();
</script>
