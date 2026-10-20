<template>
	<button
		class="text-on-surface-dim border-on-surface-disabled/25 outline-accent-blue-interactive flex items-center gap-100 border-y-2 px-200 py-150 transition-colors hover:cursor-pointer focus-visible:outline-3 focus-visible:-outline-offset-3"
		type="button"
	>
		<Icon
			size="sm"
			type="caret-left"
		/>
		<span class="text-body-small">{{ t('dialog.back') }}</span>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const { t } = useI18n();
</script>
