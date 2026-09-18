import { type IStateEvent } from 'matrix-js-sdk';
import { describe, expect, test } from 'vitest';

import { mergeStateEvents } from '@hub-client/logic/utils/roomUtils';

const stateEvent = (overrides: Partial<IStateEvent> = {}): IStateEvent =>
	({
		type: 'm.room.power_levels',
		state_key: '',
		content: { users: {} },
		sender: '@alice:example.com',
		event_id: '$event1',
		origin_server_ts: 1000,
		...overrides,
	}) as IStateEvent;

describe('mergeStateEvents', () => {
	test('appends an event whose (type, state_key) is not present yet', () => {
		const existing = [stateEvent()];

		mergeStateEvents([stateEvent({ type: 'm.room.name', content: { name: 'room' } })], existing);

		expect(existing).toHaveLength(2);
	});

	test('replaces an existing event with a newer one for the same key', () => {
		const existing = [stateEvent({ content: { users: { '@alice:example.com': 50 } } })];

		mergeStateEvents([stateEvent({ origin_server_ts: 2000, content: { users: { '@alice:example.com': 100 } } })], existing);

		expect(existing).toHaveLength(1);
		expect(existing[0].content.users).toEqual({ '@alice:example.com': 100 });
	});

	test('keeps the newer event when a batch delivers duplicates out of order', () => {
		const existing: IStateEvent[] = [];

		mergeStateEvents(
			[
				stateEvent({ origin_server_ts: 2000, content: { users: { '@alice:example.com': 100 } } }),
				stateEvent({ origin_server_ts: 1000, content: { users: { '@alice:example.com': 50 } } }),
			],
			existing,
		);

		expect(existing).toHaveLength(1);
		expect(existing[0].content.users).toEqual({ '@alice:example.com': 100 });
	});

	test('does not let a stale event overwrite newer existing state', () => {
		const existing = [stateEvent({ origin_server_ts: 2000, content: { users: { '@alice:example.com': 100 } } })];

		mergeStateEvents([stateEvent({ origin_server_ts: 1000, content: { users: { '@alice:example.com': 50 } } })], existing);

		expect(existing[0].content.users).toEqual({ '@alice:example.com': 100 });
	});

	test('merges other state events without touching unrelated keys', () => {
		const existing = [stateEvent(), stateEvent({ type: 'm.room.member', state_key: '@bob:example.com' })];

		mergeStateEvents([stateEvent({ origin_server_ts: 3000 })], existing);

		expect(existing).toHaveLength(2);
		expect(existing[1].state_key).toBe('@bob:example.com');
	});
});
