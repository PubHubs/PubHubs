<template>
	<div
		role="status"
		class="bg-surface-sunken text-label-small flex items-center gap-100 px-200 py-100"
	>
		<Icon
			type="wifi-slash"
			size="sm"
		/>
		<span>{{ t('state.hub_offline') }}</span>
	</div>
</template>

<script setup lang="ts">
	// Shown while this hub's server can't be reached (see logic/core/reachability.ts).
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';

	const { t } = useI18n();
</script>
