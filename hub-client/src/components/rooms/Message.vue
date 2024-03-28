<template>
	<p v-html="parsedMessage"></p>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { createLinks, sanitizeHtml } from '@/core/sanitizer';
	import { User } from '@/store/store';
	import { M_MessageEvent } from '@/types/events';

	// Tags for mentions
	const startTag = '<span class="inline-block bg-avatar-lime text-white px-1 py-0 rounded-md">';
	const endTag = '</span>';

	const props = defineProps<{ event: M_MessageEvent; users: Array<User> }>();

	/**
	 *
	 * Parse message
	 *
	 */
	const parsedMessage = computed(() => {
		// isHTML ?
		let body = props.event.content.body;
		if (props.event.content.msgtype == 'm.text') {
			if (typeof props.event.content.format == 'string') {
				if (props.event.content.format == 'org.matrix.custom.html' && typeof props.event.content.formatted_body == 'string') {
					body = props.event.content.formatted_body;
				}
			}
		}

		// Find Url's and make them clickable
		body = createLinks(body);

		// Find Mentions
		body = replaceMentions(body, props.users);

		// Find newlines and replace them with <br/>
		body = body.replace(/\r?\n/g, '<br/>');

		// sanitize
		body = sanitizeHtml(body);
		return body;
	});

	// What is a user combined word with mention such as hello@example.com. This should fix the space first.
	// Main purpose is to insert special characters before and after mention to easily split and style it.
	const replaceMentions = (message: string, userList: Array<User>): string => {
		if (message.match(/^@|\s@/)) {
			for (const user of userList) {
				const displayName = user.rawDisplayName?.toString();
				if (displayName && (message.includes(displayName) || message === displayName)) {
					if (message.at(message.indexOf(displayName) - 2) != ' ') {
						message = message.replaceAll('@' + displayName, startTag + '@' + displayName + endTag);
					}
					if (message.at(message.indexOf(displayName) + displayName.length) != ' ') {
						message = message.replaceAll('@' + displayName, startTag + '@' + displayName + endTag);
					}
					if (message.at(message.indexOf(displayName) - 2) == ' ') {
						message = message.replaceAll('@' + displayName, startTag + '@' + displayName + endTag);
					}
					if (message.at(message.indexOf(displayName) + displayName.length) == ' ') {
						message = message.replaceAll('@' + displayName, startTag + '@' + displayName + endTag);
					}
				}
			}
		}
		return message;
	};
</script>
