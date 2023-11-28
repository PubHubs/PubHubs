<template>
	<p>
		<span v-for="(word, index) in styledMessage" :key="index">
			<span v-if="word.includes('@') && userExists(word, props.users)">
				<div class="display: inline bg-avatar-lime text-white px-2 py-1 rounded-full">
					{{ word }}
				</div>
			</span>
			<span v-else>
				{{ ' ' + word + ' ' }}
			</span>
		</span>
	</p>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { createLinks, sanitizeHtml } from '@/core/sanitizer';
	import { User as MatrixUser } from 'matrix-js-sdk';

	const props = defineProps({
		users: {
			type: Array,
			default: () => [] as Array<MatrixUser>,
		},
		message: {
			type: String,
			default: null,
		},
	});

	// watch(props, () => {
	// 	// Style mentions in the message.
	// 	setMentionUser(props.message, props.users);
	// });

	const styledMessage = computed(() => {
		let body = sanitizeHtml(props.message);

		// Find 'reply to' in the message and give it some styling.
		body = body.replace(/^>\s*<([^>]*)>(.*)\n\n(.*)/g, '<div class="text-white rounded-lg p-1">`<span class="text-gray-300">$1</span> : $2`</div>$3');

		body = handleAndInsertSymbol(body, props.users);

		// Find Url's and make them clickable
		body = createLinks(body);

		// Find newlines and replace them with <br/>
		body = body.replace(/\r?\n/g, '<br/>');

		// This is an insertion point for identifying a user id which has a specific format in PubHubs.
		// it can be df0-4dr  or a - df0-4dr or a b c - df0-4dr or so on...
		// Writing a regex for this will be problematic especially for debugging.
		return body.split(';&$');
	});

	// What is a user combined word with mention such as hello@example.com. This should fix the space first.
	// Main purpose is to insert special characters before and after mention to easily split and style it.
	const handleAndInsertSymbol = (message: string, userList: Array<MatrixUser>): string => {
		if (message.includes('@')) {
			for (const user of userList) {
				const displayName = user.rawDisplayName?.toString();
				if (displayName && (message.includes(displayName) || message === displayName)) {
					if (message.at(message.indexOf(displayName) - 2) != ' ') {
						message = message.replaceAll('@' + displayName, ' ' + ';&$' + '@' + displayName);
					}
					if (message.at(message.indexOf(displayName) + displayName.length) != ' ') {
						message = message.replaceAll('@' + displayName, '@' + displayName + ' ' + ';&$');
					}
					if (message.at(message.indexOf(displayName) - 2) == ' ') {
						message = message.replaceAll('@' + displayName, ';&$' + '@' + displayName);
					}
					if (message.at(message.indexOf(displayName) + displayName.length) == ' ') {
						message = message.replaceAll('@' + displayName, '@' + displayName + ';&$');
					}
				}
			}
		}
		return message;
	};

	const userExists = (mentionedUser: string, userList: Array<MatrixUser>): boolean => {
		for (const user of userList) {
			const displayName = '@' + user.rawDisplayName?.toString();
			if (displayName && displayName === mentionedUser) {
				return true;
			}
		}

		return false;
	};
</script>
