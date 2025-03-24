<template>
	<div :class="['relative flex h-screen w-full flex-col justify-between overflow-hidden', bgBarLow]">
		<div class="z-10 flex h-full flex-col overflow-hidden">
			<div :class="['flex h-16 flex-col justify-center p-3 md:h-24 md:justify-start md:p-4', bgBarMedium]">
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
	import { defineProps } from 'vue';

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
