<template>
	<p v-html="parsedMessage"></p>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { createLinks, sanitizeHtml } from '@/core/sanitizer';

	const props = defineProps<{ message: string }>();

	/**
	 *
	 * Parse message
	 *
	 */
	const parsedMessage = computed(() => {
		let body = props.message;
		// sanitize

		body = sanitizeHtml(body);
		// Find 'reply to' in the message and give it some styling.
		body = body.replace(/^>\s*<([^>]*)>(.*)\n\n(.*)/g, '<div class="text-white rounded-lg p-1">`<span class="text-gray-300">$1</span> : $2`</div>$3');

		// Find Url's and make them clickable
		body = createLinks(body);

		// Find newlines and replace them with <br/>
		body = body.replace(/\r?\n/g, '<br/>');
		return body;
	});
</script>
