<template>
	<div class="w-full pt-200 break-words whitespace-pre-line">
		{{ description }}
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';

	const props = defineProps<{
		event: TimelineEvent;
	}>();

	const description = computed(() => {
		if (props.event.matrixEvent.event.content?.ph_topic_body) return props.event.matrixEvent.event.content.ph_topic_body;
		if (props.event.matrixEvent.event.content?.description) return props.event.matrixEvent.event.content.description;
		return '';
	});
</script>
