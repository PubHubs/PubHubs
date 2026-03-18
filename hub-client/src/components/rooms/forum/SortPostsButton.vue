<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<ActionMenu icon="arrows-down-up">
			<ActionMenuItem v-for="option in sortOptions" :key="option.key" @click="sortingStore.toggleOption(option.key)" class="flex items-center gap-2">
				<Icon :type="option.icon"></Icon>
				{{ option.label }}
				<Icon :type="sortingStore.getDirectionIcon(option.key)"></Icon>
			</ActionMenuItem>
		</ActionMenu>
	</div>
</template>

<script setup lang="ts">
	// Components
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	// Stores
	import { useSortingStore } from '@hub-client/stores/forum/sortingStore';
	import { sortOptions } from '@hub-client/stores/forum/sortingStore';

	const sortingStore = useSortingStore();
</script>
