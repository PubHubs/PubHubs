<template>
	<div class="w-full">
		<slot :activeTab="activeTab" :setActiveTab="setActiveTab"></slot>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { provide, ref } from 'vue';

	// Props
	const props = withDefaults(
		defineProps<{
			openTab?: number;
		}>(),
		{
			openTab: 0,
		},
	);

	const activeTab = ref(props.openTab);

	const setActiveTab = (tab: number) => {
		activeTab.value = tab;
	};

	provide('activeTab', activeTab);
	provide('setActiveTab', setActiveTab);
</script>
