// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Composables
import { useMessageBody } from '@hub-client/composables/message-body.composable';

describe('useMessageBody', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	test('prefers the processed body', () => {
		const { messageBody } = useMessageBody(
			() => 'plain',
			() => '<b>processed</b>',
		);

		expect(messageBody.value).toEqual('<b>processed</b>');
	});

	// Defence in depth: ph_body is set by eventTimeLineHandler, but a message that has not been through
	// it must not have its raw body handed to v-safe-html - the sanitizer would drop everything from a
	// literal `<` up to the next `>`.
	test('escapes the raw body when falling back to it', () => {
		const { messageBody } = useMessageBody(
			() => 'Predicate("100<H|") >= obs1',
			() => undefined,
		);

		expect(messageBody.value).toEqual('Predicate("100&lt;H|") &gt;= obs1');
	});

	test('handles a missing body', () => {
		const { messageBody } = useMessageBody(
			() => undefined,
			() => undefined,
		);

		expect(messageBody.value).toEqual('');
	});
});
