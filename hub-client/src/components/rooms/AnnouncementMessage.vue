<template>
	<div class="flex flex-row items-center gap-1 break-words pb-4">
		<p v-html="event.body" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Components
	import { TAnnouncementMessageEventContent } from '@/model/events/TMessageEvent';

	const props = defineProps<{
		event: TAnnouncementMessageEventContent;
	}>();
</script>
