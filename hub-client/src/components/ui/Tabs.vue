<template>
	<div>
		<slot></slot>
	</div>
</template>
<script setup lang="ts">
	import { ref, provide } from 'vue';

	const activeTab = ref(1);
	const numberOfTabs = ref(0);
	const numberOfTabHeaders = ref(0);

	const registerTabHeader = () => {
		numberOfTabHeaders.value++;
		return numberOfTabHeaders.value;
	};

	const registerTab = () => {
		numberOfTabs.value++;
		return numberOfTabs.value;
	};

	const removeTab = () => {
		numberOfTabHeaders.value--;
		numberOfTabs.value--;
		if (activeTab.value > numberOfTabs.value) {
			activeTab.value = numberOfTabs.value;
		}
	};

	const setActiveTab = (tab: number) => {
		activeTab.value = tab;
	};

	const isActiveTab = (tab: number): boolean => {
		return activeTab.value === tab;
	};

	provide('registerTabHeader', registerTabHeader);
	provide('registerTab', registerTab);
	provide('removeTab', removeTab);
	provide('setActiveTab', setActiveTab);
	provide('isActiveTab', isActiveTab);
</script>
