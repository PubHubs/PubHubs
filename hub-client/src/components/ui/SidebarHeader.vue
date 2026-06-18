<template>
	<div class="flex shrink-0 items-center justify-between gap-200 px-200 pb-200">
		<div class="flex min-w-0 items-center gap-200">
			<slot name="left" />
			<slot>
				<h3 class="text-on-surface text-md line-clamp-1 min-w-0 truncate font-semibold first-letter:uppercase">
					{{ title }}
				</h3>
			</slot>
		</div>
		<button
			v-if="!isMobile"
			:aria-label="t('dialog.close')"
			class="text-on-surface-dim hover:text-on-surface hover:bg-surface-elevated p-050 rounded-md transition-colors hover:cursor-pointer"
			:title="t('dialog.close')"
			@click="
				sidebar.close();
				emit('close');
			"
		>
			<Icon
				size="sm"
				type="x"
			/>
		</button>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	defineProps<{
		title?: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const { t } = useI18n();
	const sidebar = useSidebar();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
