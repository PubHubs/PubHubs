<template>
	<div :class="['relative flex h-screen w-full flex-col justify-between overflow-hidden', bgBarLow]">
		<div class="z-10 flex h-full flex-col overflow-hidden">
			<div :class="['flex-co flex h-[80px]', bgBarMedium, isMobile ? 'justify-center p-4' : 'justify-start p-4']">
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

	const props = defineProps({
		bgBarLow: {
			type: String,
			default: 'bg-surface-low',
		},
		bgBarMedium: {
			type: String,
			default: 'bg-surface',
		},
	});
</script>
