import { EventType, MsgType } from 'matrix-js-sdk';
import { describe, expect, test } from 'vitest';

import { PubHubsMgType } from '@hub-client/logic/core/events';

import { Redaction, RelationType } from '@hub-client/models/constants';
import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { isVisibleEvent } from '@hub-client/models/events/isVisibleEvent';

const userId = '@alice:example.com';

function baseEvent(overrides: Partial<TBaseEvent> = {}): Partial<TBaseEvent> {
	return {
		type: EventType.RoomMessage,
		content: { msgtype: MsgType.Text, body: 'hello' },
		sender: '@bob:example.com',
		event_id: '$event1',
		origin_server_ts: 1000,
		room_id: '!room:example.com',
		...overrides,
	};
}

describe('isVisibleEvent', () => {
	test('regular text message is visible', () => {
		expect(isVisibleEvent(baseEvent(), userId)).toBe(true);
	});

	test('state event (m.room.member) is not visible', () => {
		expect(isVisibleEvent(baseEvent({ type: 'm.room.member' }), userId)).toBe(false);
	});

	test('reaction is not visible', () => {
		expect(isVisibleEvent(baseEvent({ type: EventType.Reaction }), userId)).toBe(false);
	});

	test('notice is not visible', () => {
		expect(isVisibleEvent(baseEvent({ content: { msgtype: MsgType.Notice, body: 'notice' } }), userId)).toBe(false);
	});

	test('thread reply is not visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					content: {
						msgtype: MsgType.Text,
						body: 'reply',
						'm.relates_to': { rel_type: RelationType.Thread, event_id: '$root' },
					},
				}),
				userId,
			),
		).toBe(false);
	});

	test('whisper to current user is visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					content: { msgtype: PubHubsMgType.WhisperMessage, body: 'psst', whisper_to: userId },
				}),
				userId,
			),
		).toBe(true);
	});

	test('whisper from current user is visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					sender: userId,
					content: { msgtype: PubHubsMgType.WhisperMessage, body: 'psst', whisper_to: '@charlie:example.com' },
				}),
				userId,
			),
		).toBe(true);
	});

	test('whisper between other users is not visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					content: { msgtype: PubHubsMgType.WhisperMessage, body: 'psst', whisper_to: '@charlie:example.com' },
				}),
				userId,
			),
		).toBe(false);
	});

	test('redacted thread event is not visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					unsigned: {
						redacted_because: {
							redacts: '$event1',
							content: { reason: Redaction.DeletedFromThread },
						},
					},
				}),
				userId,
			),
		).toBe(false);
	});

	test('redacted non-thread event is visible', () => {
		expect(
			isVisibleEvent(
				baseEvent({
					unsigned: {
						redacted_because: {
							redacts: '$event1',
							content: { reason: Redaction.Deleted },
						},
					},
				}),
				userId,
			),
		).toBe(true);
	});

	test('event with undefined type passes', () => {
		expect(isVisibleEvent(baseEvent({ type: undefined }), userId)).toBe(true);
	});

	test('event with no content passes if type is RoomMessage', () => {
		expect(isVisibleEvent({ type: EventType.RoomMessage }, userId)).toBe(true);
	});
});
