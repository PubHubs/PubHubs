<template>
	<div class="flex flex-row items-center gap-1 break-words">
		<button
			@click="sortingStore.openMenu()"
			class="bg-accent-primary text-on-accent-primary inline-flex items-center gap-2 rounded-[8px] px-4 py-[10px] font-bold transition-colors duration-300 hover:bg-sky-700"
			aria-label="Open sorting menu"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
			</svg>
			<span>Sort</span>
		</button>

		<SortingMenu v-if="sortingStore.isMenuOpen" />
	</div>
</template>

<script setup lang="ts">
	// Components
	import SortingMenu from '@hub-client/components/rooms/forum/SortingMenu.vue';

	// Stores
	import { useSortingStore } from '@hub-client/stores/forum/sortingStore';

	const sortingStore = useSortingStore();
</script>
