<template>
	<div class="flex flex-row items-center gap-1 break-words">
		<Icon v-if="deleted" type="bin" size="sm"></Icon>
		<p v-html="message" :class="{ 'text-gray dark:text-gray-lighter': deleted }" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const props = defineProps<{ event: TMessageEvent; deleted: boolean }>();

	const message = computed(() => {
		return props.deleted ? t('message.delete.message_deleted') : props.event.content.ph_body;
	});
</script>
