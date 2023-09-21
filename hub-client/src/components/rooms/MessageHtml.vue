<template>
	<p class="mt-2" v-html="parsedMessage"></p>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { sanitizeHtml } from '@/core/sanitizer';

	const props = defineProps({
		message: {
			type: String,
			required: true,
		},
	});

	/**
	 *
	 * Parse HTML message
	 *
	 */
	const parsedMessage = computed(() => {
		let html = props.message;
		html = sanitizeHtml(html);
		return html;
	});
</script>
