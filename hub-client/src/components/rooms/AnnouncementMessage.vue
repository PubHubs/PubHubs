<template>
	<div class="flex flex-row items-center gap-1 pb-4 break-words">
		<p v-html="event.body" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Models
	import { TAnnouncementMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	const props = defineProps<{
		event: TAnnouncementMessageEventContent;
	}>();
</script>
