<template>
	<div role="tab" class="tabs-tab theme-light:border-gray theme-light:text-gray z-20 min-h-550 cursor-pointer rounded-t border border-b-0 px-200" :class="activeClass" @click="setActiveTab(tab)">
		<div class="flex h-full w-full items-center justify-center">
			<slot :active="isActiveTab(tab)"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, inject, onMounted, ref } from 'vue';

	const registerTabHeader = inject('registerTabHeader') as Function;
	const setActiveTab = inject('setActiveTab') as Function;
	const isActiveTab = inject('isActiveTab') as Function;
	const tab = ref(0);

	onMounted(() => {
		tab.value = registerTabHeader();
	});

	const activeClass = computed(() => {
		let c = '';
		if (tab.value > 1) {
			c += 'ml-2';
		}
		if (isActiveTab(tab.value)) {
			c += ' bg-white dark:bg-transparent';
		} else {
			c += ' bg-transparent opacity-50';
		}
		return c;
	});
</script>

<style scoped>
	.tabs-tab {
		margin-bottom: -1px;
	}
</style>
