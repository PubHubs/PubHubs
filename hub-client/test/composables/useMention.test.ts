// Packages
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test } from 'vitest';

// Composable
import { useMentions } from '@hub-client/composables/useMentions';

// Model
import { MentionMatch } from '@hub-client/models/components/TMessage';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

// Test constants
const body = 'Dit is #test~!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host~ ja';
const body2 = '#test~!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host~';
const body3 = '#test';
const expectedMention = [
	{
		type: '#',
		start: 7,
		end: 53,
		displayName: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-7',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
];
const expectedSegment = [
	{ type: 'text', content: 'Dit is ', id: null },
	{
		type: 'room',
		displayName: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-7',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
	{ type: 'text', content: ' ja', id: null },
];
const expectedMention2 = [
	{
		type: '#',
		start: 0,
		end: 46,
		displayName: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-0',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
];
const expectedSegment2 = [
	{
		type: 'room',
		displayName: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-0',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
];
const expectedSegment3 = [{ type: 'text', content: '#test', id: null }];

describe('useMentions', () => {
	setActivePinia(createPinia());
	// Need a valid roomId to link to
	useRooms().publicRooms = [{ room_id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host' }];
	const mentionComposable = useMentions();

	// Test a mention within normal text
	test('parseMentions&buildSegments1', () => {
		const mentions: MentionMatch[] = mentionComposable.parseMentions(body);
		expect(mentions).toEqual(expectedMention);
		const segments = mentionComposable.buildSegments(body, mentions);
		expect(segments).toEqual(expectedSegment);
	});
	// Test a mention alone
	test('parseMentions&buildSegments2', () => {
		const mentions: MentionMatch[] = mentionComposable.parseMentions(body2);
		expect(mentions).toEqual(expectedMention2);
		const segments = mentionComposable.buildSegments(body2, mentions);
		expect(segments).toEqual(expectedSegment2);
	});
	// Test an incorrect mention
	test('parseMentions&buildSegments3', () => {
		const mentions: MentionMatch[] = mentionComposable.parseMentions(body3);
		expect(mentions).toEqual([]);
		const segments = mentionComposable.buildSegments(body3, mentions);
		expect(segments).toEqual(expectedSegment3);
	});
});
