// Packages
import { describe, expect, test } from 'vitest';

// Models
import { editedContent, withEdit } from '@hub-client/models/events/edits';

const original = {
	event_id: '$original',
	sender: '@alice:hub',
	content: {
		msgtype: 'm.text',
		body: 'original',
		'm.relates_to': { 'm.in_reply_to': { event_id: '$parent' } },
	},
};

const edit = {
	sender: '@alice:hub',
	origin_server_ts: 1000,
	content: {
		msgtype: 'm.text',
		body: '* edited',
		'm.new_content': { msgtype: 'm.text', body: 'edited' },
		'm.relates_to': { rel_type: 'm.replace', event_id: '$original' },
	},
};

describe('edits', () => {
	test('replaces the content and keeps the original relation', () => {
		expect(editedContent(original, edit)).toEqual({
			msgtype: 'm.text',
			body: 'edited',
			'm.relates_to': { 'm.in_reply_to': { event_id: '$parent' } },
			ph_edited_ts: 1000,
		});
	});

	test('ignores edits from another sender', () => {
		expect(editedContent(original, { ...edit, sender: '@mallory:hub' })).toBeUndefined();
	});

	test('ignores an edit older than the one already applied', () => {
		const alreadyEdited = { ...original, content: { ...original.content, ph_edited_ts: 2000 } };
		expect(editedContent(alreadyEdited, edit)).toBeUndefined();
	});

	test('withEdit returns a copy and leaves the input untouched', () => {
		const result = withEdit(original, edit);
		expect(result).not.toBe(original);
		expect(result.event_id).toBe('$original');
		expect(result.content.body).toBe('edited');
		expect(original.content.body).toBe('original');
	});

	test('withEdit returns the event itself without an applicable edit', () => {
		expect(withEdit(original, undefined)).toBe(original);
	});
});
