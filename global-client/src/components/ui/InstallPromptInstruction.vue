<template>
	<div v-for="(item, index) in instructions" :key="index">
		<p class="uppercase text-accent-primary ~text-label-small-min/label-small-max" :class="{ 'mt-3': index > 0 }">{{ $t('others.step', [index + 1]) }}</p>
		<div class="flex gap-1">
			<Icon :type="item.icon" size="sm" class="pt-1" />
			<p class="font-bold">{{ $t(item.instruction) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Package imports
	import { PropType } from 'vue';

	// Hub imports
	import Icon from '../../../../hub-client/src/components/elements/Icon.vue';

	defineProps({
		instructions: {
			type: Array as PropType<{ icon: string; instruction: string }[]>,
			required: true,
		},
	});
</script>
