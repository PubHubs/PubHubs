<template>
	<p class="mt-2" v-html="parsedMessage"></p>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { createLinks } from '@/core/extensions';

	const props = defineProps({
		message: {
			type: String,
			required: true,
		},
	});

	/**
	 *
	 * Parse message
	 *
	 */
	const parsedMessage = computed(() => {
		let body = props.message;
		// Find 'reply to' in the message and give it some styling.
		body = body.replace(/^>\s*<([^>]*)>(.*)\n\n(.*)/g, '<div class="text-white rounded-lg p-1">`<span class="text-gray-300">$1</span> : $2`</div>$3');
		// Find Url's and make them clickable
		body = createLinks(body);
		return body;
	});
</script>
