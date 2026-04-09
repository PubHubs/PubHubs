<template>
	<div class="pt-2">
		{{ event.content.ph_topic_body }}
	</div>
</template>

<script setup lang="ts">
	defineProps({
		event: {
			type: Object,
			required: true,
		},
		isFirst: {
			type: Boolean,
			default: false,
		},
	});
</script>
