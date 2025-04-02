<template>
	<div :class="['relative flex h-screen w-full flex-col justify-between overflow-hidden', bgBarLow]">
		<div class="z-10 flex h-full flex-col overflow-hidden">
			<div :class="['flex flex-col', bgBarMedium, isMobile ? 'h-[7.5rem] justify-center p-3' : 'h-[10rem] justify-start p-4']">
				<slot name="header"></slot>
			</div>
			<div class="relative flex-1 overflow-y-auto">
				<slot class="p-3 md:p-4"></slot>
			</div>
		</div>
		<div>
			<slot name="footer"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Vue imports
	import { computed } from 'vue';

	// Hub imports
	import { useSettings } from '@/logic/store/settings';

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
