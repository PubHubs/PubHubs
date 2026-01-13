/**
 * Tests for the `useMentions` composable.
 *
 * This test verifies:
 * - Correct parsing of mentions from a message (`parseMentions`)
 * - Correct building of text around mentions (`buildSegments`)
 * - Validation logic: only valid rooms should produce mention objects
 * - Handling of cases such as:
 *    - Mentions inside normal text
 *    - A message that is only a mention
 *    - Invalid mention syntax
 *    - Multiple mentions inside a single message
 *
 * These tests are only for rooms since they are easier to mock
 * and since user and room mentions use exactly the same logic
 * (except for the function that is hard to mock)
 *
 * The tests rely on a minimal Pinia setup and a mocked rooms store:
 * added one room mock to`useRooms().publicRooms` to allow validation of
 * `#room~roomId~` tokens.
 */
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
const body4 = 'Dit is een test voor #test~!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host~ en #test~!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host~';
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
		content: '#test',
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
		content: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-0',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
];
const expectedSegment3 = [{ type: 'text', content: '#test', id: null }];
const expectedMention4 = [
	{
		displayName: '#test',
		end: 67,
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-21',
		start: 21,
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
		type: '#',
	},
	{
		displayName: '#test',
		end: 117,
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-71',
		start: 71,
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
		type: '#',
	},
];
const expectedSegment4 = [
	{ type: 'text', content: '#test', id: null },
	{
		type: 'room',
		content: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-21',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
	{ type: 'text', content: '', id: null },
	{
		type: 'room',
		content: '#test',
		id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host-71',
		tokenId: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host',
	},
];

describe('useMentions', () => {
	setActivePinia(createPinia());
	// Need a valid roomId to link to
	useRooms().publicRooms = [{ room_id: '!ZXaxkYUwdQwHiPwvyA:testhub.matrix.host', name: 'test' }];
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
	// Test two mentions within normal text
	test('parseMentions&buildSegments4', () => {
		const mentions: MentionMatch[] = mentionComposable.parseMentions(body4);
		expect(mentions).toEqual(expectedMention4);
		const segments = mentionComposable.buildSegments(body3, mentions);
		expect(segments).toEqual(expectedSegment4);
	});
});
