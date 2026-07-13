<template>
	<div
		v-safe-html="{ html: parsedMarkdown, options: markdownSanitizeOptions }"
		class="markdown-preview wrap-break-words max-w-none"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { marked } from 'marked';
	import type { IOptions as SanitizeOptions } from 'sanitize-html';
	import { computed } from 'vue';

	const props = defineProps<{
		content: string;
	}>();

	const markdownSanitizeOptions: SanitizeOptions = {
		allowedTags: [
			'h1',
			'h2',
			'p',
			'br',
			'hr',
			'ul',
			'ol',
			'li',
			'blockquote',
			'strong',
			'em',
			'a',
			'pre',
			'code',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
		],
		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height'],
			code: ['class'],
			pre: ['class'],
		},
	};

	// The hub client runs inside an iframe, so links must open in a new tab instead of navigating the iframe
	const renderer = new marked.Renderer();
	const defaultLinkRenderer = renderer.link.bind(renderer);
	renderer.link = (href, title, text) => defaultLinkRenderer(href, title, text).replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');

	const parsedMarkdown = computed(() => {
		if (!props.content) return '';
		return marked.parse(props.content, { async: false, renderer }) as string;
	});
</script>
