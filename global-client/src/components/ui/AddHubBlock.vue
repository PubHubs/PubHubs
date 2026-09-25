<template>
	<button
		class="group bg-surface-base border-surface-elevated rounded-base focus-visible:ring-accent-blue-interactive hover:border-accent-blue-interactive relative flex w-full max-w-full cursor-pointer flex-col overflow-hidden border-3 border-dashed text-left transition-colors outline-none focus-visible:ring-3"
		type="button"
		@click="emit('discover')"
	>
		<!-- Stands in for the hub banner so the card keeps the same footprint as a pinned hub. -->
		<div
			class="bg-surface-base flex w-full flex-1 items-center justify-center"
			:class="isMobile ? 'min-h-1000' : 'min-h-1500'"
		>
			<Icon
				aria-hidden="true"
				class="text-on-surface-disabled group-hover:text-accent-blue-interactive transition-colors"
				type="plus"
			/>
		</div>
		<div class="flex h-1400 shrink-0 items-start gap-200 p-250 sm:p-300">
			<div
				class="bg-surface-base text-on-surface-dim group-hover:text-accent-blue-interactive flex aspect-square h-600 w-600 shrink-0 items-center justify-center rounded-xl transition-colors"
			></div>
			<div class="gap-050 flex min-w-0 flex-col pr-200">
				<h2 class="truncate font-bold">{{ t('home.add_hub') }}</h2>
				<p class="text-label text-on-surface-dim line-clamp-2">{{ t('home.add_hub_description') }}</p>
			</div>
		</div>
	</button>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const emit = defineEmits<{ discover: [] }>();

	const { t } = useI18n();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
