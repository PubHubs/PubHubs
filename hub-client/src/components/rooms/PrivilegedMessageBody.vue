<template>
	<div class="wrap-break-words gap-050 flex flex-row items-center">
		<p
			v-safe-html="props.event.body ?? ''"
			class="overflow-hidden text-ellipsis"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Models
	import { type TAnnouncementMessageEventContent, type TWhisperMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{
		event: TAnnouncementMessageEventContent | TWhisperMessageEventContent;
	}>();
</script>
