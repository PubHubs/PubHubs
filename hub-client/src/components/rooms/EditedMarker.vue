<template>
	<div
		class="text-on-surface-dim text-label-tiny cursor-pointer"
		:title="t('message.edited_at', { datetime: formatted })"
	>
		{{ t('message.edited') }}
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Composables
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	const props = defineProps<{
		// origin_server_ts of the edit (ph_edited_ts), stamped by the TimelineManager when the edit is applied
		timestamp: number;
	}>();

	const { t } = useI18n();
	const { formattedTimeInformation } = useTimeFormat();

	const formatted = computed(() => formattedTimeInformation(props.timestamp));
</script>
