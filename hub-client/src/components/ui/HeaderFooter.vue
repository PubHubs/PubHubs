<template>
	<div class="border-on-surface-disabled/25 relative flex h-full w-full flex-col justify-between overflow-hidden border-r-2">
		<div class="z-10 flex h-full flex-col overflow-hidden">
			<div
				class="border-on-surface-disabled/25 flex h-1000 flex-col justify-start border-b-2"
				:class="isMobile ? 'p-150' : 'p-200'"
			>
				<slot name="header" />
			</div>
			<div class="relative flex-1 overflow-x-hidden overflow-y-auto">
				<slot :class="isMobile ? 'p-150' : 'p-200'" />
			</div>
		</div>
		<div>
			<slot name="footer" />
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
</script>
