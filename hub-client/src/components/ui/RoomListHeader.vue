<template>
	<section class="flex flex-col gap-2" :title="tooltipText && t(tooltipText)">
		<div class="group bg-surface rounded-base flex items-center justify-between px-4 py-2">
			<div class="flex h-[24px] w-full items-center justify-between">
				<p class="truncate leading-tight font-bold" role="heading">{{ t(label) }}</p>
				<span v-if="tooltipText != undefined" class="ml-2 hover:cursor-help">
					<Icon type="info" class="text-on-surface-dim" />
				</span>
			</div>
		</div>
		<slot name="roomlist"></slot>
	</section>
</template>

<script setup lang="ts">
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	const props = defineProps<{
		label: string;
		tooltipText?: string;
	}>();

	const { t } = useI18n();
</script>
