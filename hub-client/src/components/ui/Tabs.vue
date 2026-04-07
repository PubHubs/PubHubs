<template>
	<div class="w-full">
		<slot
			:active-tab="activeTab"
			:set-active-tab="setActiveTab"
		/>
	</div>
</template>

<script lang="ts" setup>
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
