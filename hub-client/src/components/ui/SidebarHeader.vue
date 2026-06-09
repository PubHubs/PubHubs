<template>
	<div class="flex shrink-0 items-center justify-between gap-4 px-4 pb-4">
		<h3 class="text-on-surface text-md line-clamp-1 min-w-0 truncate font-semibold first-letter:uppercase">
			{{ title }}
		</h3>
		<button
			v-if="!isMobile"
			:aria-label="t('dialog.close')"
			class="text-on-surface-dim hover:text-on-surface hover:bg-surface-elevated rounded-md p-1 transition-colors hover:cursor-pointer"
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
		title: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const { t } = useI18n();
	const sidebar = useSidebar();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
