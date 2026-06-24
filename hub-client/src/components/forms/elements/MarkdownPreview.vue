<template>
	<!-- eslint-disable vue/no-v-html -- content sanitized by sanitizedHtml -->
	<div
		class="markdown-preview wrap-break-words max-w-none"
		v-html="sanitizedHtml"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { marked } from 'marked';
	import sanitizeHtml from 'sanitize-html';
	import { computed } from 'vue';

	const props = defineProps<{
		content: string;
	}>();

	const sanitizedHtml = computed(() => {
		if (!props.content) return '';
		const html = marked.parse(props.content, { async: false }) as string;
		return sanitizeHtml(html, {
			allowedTags: ['h1', 'h2', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
			allowedAttributes: {
				a: ['href', 'title', 'target', 'rel'],
				img: ['src', 'alt', 'title', 'width', 'height'],
				code: ['class'],
				pre: ['class'],
			},
		});
	});
</script>
