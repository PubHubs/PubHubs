<template>
	<div
		v-for="(item, index) in instructions"
		:key="index"
	>
		<H3
			class="text-accent-primary text-label-small uppercase"
			:class="{ 'mt-150': index > 0 }"
		>
			{{ $t('others.step', [index + 1]) }}
		</H3>
		<div class="gap-050 flex items-center">
			<Icon :type="item.icon" />
			<p class="font-bold">
				{{ $t(item.instruction) }}
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType } from 'vue';

	// Componments
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		instructions: {
			type: Array as PropType<{ icon: string; instruction: string }[]>,
			required: true,
		},
	});
</script>
