<template>
	<div class="wrap-break-words gap-050 flex flex-row items-center">
		<MessageBodyWithMentions
			:body="props.event.body"
			:ph-body="props.event.ph_body"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';

	// Models
	import { type TAnnouncementMessageEventContent, type TWhisperMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{
		event: TAnnouncementMessageEventContent | TWhisperMessageEventContent;
	}>();
</script>
