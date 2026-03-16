<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<Button @click="sortingStore.openMenu()" aria-label="Open sorting menu" icon="arrows-down-up">Sort</Button>
		<SortingMenu v-if="sortingStore.isMenuOpen" />
	</div>
</template>

<script setup lang="ts">
	// Components
	import SortingMenu from '@hub-client/components/rooms/forum/SortingMenu.vue';

	// Stores
	import { useSortingStore } from '@hub-client/stores/forum/sortingStore';

	import Button from '@hub-client/new-design/components/Button.vue';

	const sortingStore = useSortingStore();
</script>
