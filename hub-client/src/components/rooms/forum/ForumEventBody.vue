<template>
	<div class="w-full pt-200">
		{{ description }}
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
		isFirst: {
			type: Boolean,
			default: false,
		},
	});

	const description = computed(() => {
		if (props.event.content.ph_topic_body) return props.event.content.ph_topic_body;
		if (props.event.content.description) return props.event.content.description;
		return '';
	});
</script>
