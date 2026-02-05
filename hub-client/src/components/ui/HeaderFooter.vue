<template>
	<div class="border-on-surface-disabled relative flex h-full w-full flex-col justify-between overflow-hidden border-r">
		<div class="z-10 flex h-full flex-col overflow-hidden">
			<div class="border-on-surface-disabled flex h-[80px] flex-col justify-start border-b p-8">
				<slot name="header"></slot>
			</div>
			<div class="relative flex-1 overflow-x-hidden overflow-y-auto">
				<slot class="p-4 md:p-4"></slot>
			</div>
		</div>
		<div>
			<slot name="footer"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
</script>
