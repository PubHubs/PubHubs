<template>
	<div class="border-on-surface-disabled/25 flex h-[80px] shrink-0 items-center border-b-2 px-400">
		<div class="flex items-center gap-100 whitespace-nowrap">
			<Icon
				class="text-on-surface"
				:type="icon"
			/>
			<div class="font-headings text-h3 font-semibold">{{ title }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	defineProps<{
		icon: string;
		title: string;
	}>();
</script>
