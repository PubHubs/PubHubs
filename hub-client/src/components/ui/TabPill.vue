<template>
	<div class="tabs-tab theme-light:border-gray theme-light:text-gray z-20 inline-block cursor-pointer rounded-t border border-b-0 px-2 py-1" :class="activeClass" @click="setActiveTab(tab)">
		<slot :active="isActiveTab(tab)"></slot>
	</div>
</template>

<script setup lang="ts">
	import { ref, computed, inject, onMounted } from 'vue';

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
