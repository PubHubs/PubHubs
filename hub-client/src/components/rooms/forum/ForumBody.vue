<template>
	<div class="pt-2">
		{{ topic.body }}
	</div>
</template>

<script setup lang="ts">
	defineProps({
		topic: {
			type: Object,
			required: true,
		},
	});
</script>
