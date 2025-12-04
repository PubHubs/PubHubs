<template>
	<div class="flex flex-row items-center gap-1 break-words">
		<Icon v-if="deleted" type="trash" size="sm" />
		<p v-html="message" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	const { t } = useI18n();
	const props = defineProps<{ event: TMessageEvent; deleted: boolean }>();

	const message = computed(() => {
		return props.deleted ? t('message.delete.message_deleted') : props.event.content.ph_body;
	});
</script>
