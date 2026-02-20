<template>
	<div class="wrap-break-words flex flex-row items-center gap-1">
		<p v-html="event.body" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Models
	import { TAnnouncementMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{
		event: TAnnouncementMessageEventContent;
	}>();
</script>
