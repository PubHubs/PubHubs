<template>
	<div v-for="(item, index) in instructions" :key="index">
		<H3 class="text-accent-primary text-label-small uppercase" :class="{ 'mt-3': index > 0 }">{{ $t('others.step', [index + 1]) }}</H3>
		<div class="flex items-center gap-1">
			<Icon :type="item.icon" />
			<p class="font-bold">{{ $t(item.instruction) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { PropType } from 'vue';

	// Componments
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		instructions: {
			type: Array as PropType<{ icon: string; instruction: string }[]>,
			required: true,
		},
	});
</script>
