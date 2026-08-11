// Packages
import { EventType, MsgType } from 'matrix-js-sdk';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Logic
import { Events, PubHubsMgType } from '@hub-client/logic/core/events';

// Only `event.event` and its content are touched for the message types under test, so a bare object
// stands in for a MatrixEvent.
const timelineEvent = (msgtype: string, body: string) =>
	({
		event: {
			type: EventType.RoomMessage,
			room_id: '##room_id##',
			content: { msgtype, body },
		},
	}) as any;

describe('Events', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('eventRoomTimeline', () => {
		const events = new Events();

		// Regression: announcements and whispers were missing from this gate, so they never got a
		// ph_body and their text was rendered raw - truncating everything from a literal `<` onwards.
		test.each([
			['announcement', PubHubsMgType.AnnouncementMessage],
			['whisper', PubHubsMgType.WhisperMessage],
			['text', MsgType.Text],
		])('processes the body of a %s message', (_label, msgtype) => {
			const event = timelineEvent(msgtype, 'Predicate("100<H|") >= obs1\nsecond line');
			events.eventRoomTimeline(event, undefined);

			expect(event.event.content.ph_body).toEqual('Predicate("100&lt;H|") &gt;= obs1<br/>second line');
		});

		test('leaves message types without a user authored body alone', () => {
			const event = timelineEvent(PubHubsMgType.VotingWidget, 'poll');
			events.eventRoomTimeline(event, undefined);

			expect(event.event.content.ph_body).toBeUndefined();
		});
	});
});
