<template>
	<div class="w-full pt-200">
		{{ description }}
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';

	const props = withDefaults(
		defineProps<{
			event: TimelineEvent;
			isFirst?: boolean;
		}>(),
		{
			isFirst: false,
		},
	);

	const description = computed(() => {
		if (props.event.matrixEvent.event.content?.ph_topic_body) return props.event.matrixEvent.event.content.ph_topic_body;
		if (props.event.matrixEvent.event.content?.description) return props.event.matrixEvent.event.content.description;
		return '';
	});
</script>
