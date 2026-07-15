<template>
	<div class="wrap-break-words flex flex-row items-center gap-1">
		<!-- eslint-disable vue/no-v-html -- sanitized via sanitizeHtml -->
		<p
			class="overflow-hidden text-ellipsis"
			v-html="sanitizedBody"
		/>
		<!-- eslint-enable vue/no-v-html -->
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Logic
	import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

	// Models
	import { type TAnnouncementMessageEventContent, type TWhisperMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{
		event: TAnnouncementMessageEventContent | TWhisperMessageEventContent;
	}>();

	const sanitizedBody = computed(() => sanitizeHtml(props.event.body ?? ''));
</script>
