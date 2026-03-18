<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<Button @click="sortingStore.openMenu()" aria-label="Open sorting menu" icon="arrows-down-up">Sort</Button>
		<SortingMenu v-if="sortingStore.isMenuOpen" />
		<ActionMenu icon="arrows-down-up">
			<ActionMenuItem v-for="option in sortOptions" :key="option.key" @click="sortingStore.toggleOption(option.key)" class="flex items-center gap-2">
				<Icon :type="option.icon"></Icon>
				{{ option.label }}
			</ActionMenuItem>
		</ActionMenu>
	</div>
</template>

<script setup lang="ts">
	// Components
	import SortingMenu from '@hub-client/components/rooms/forum/SortingMenu.vue';
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	// Stores
	import { useSortingStore } from '@hub-client/stores/forum/sortingStore';
	import { sortOptions } from '@hub-client/stores/forum/sortingStore';

	import Button from '@hub-client/new-design/components/Button.vue';

	const sortingStore = useSortingStore();
</script>
