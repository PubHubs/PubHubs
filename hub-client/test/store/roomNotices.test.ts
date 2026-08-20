// Packages
import { EventType, MsgType } from 'matrix-js-sdk';
import { type MSC3575RoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

const NOTICE_USER = '@notices_user:test';
const ROOM_ID = '!room';
const VALID_BODY = "@alice:test joined the room with attributes {'pbdf.sidn-pbdf.email.email': 'alice@ru.nl'}";

// Builds a minimal stand-in for a sliding-sync timeline entry (a plain IRoomEvent, not a MatrixEvent).
function makeTimelineEvent(overrides: Partial<{ type: string; msgtype: string; body: unknown; sender: string }> = {}) {
	const { type = EventType.RoomMessage, msgtype = MsgType.Notice, body = VALID_BODY, sender = NOTICE_USER } = overrides;
	return { type, sender, content: { msgtype, body } };
}

function makeRoomData(timeline: unknown[]): MSC3575RoomData {
	return { name: '', required_state: [], timeline } as unknown as MSC3575RoomData;
}

// These tests cover the two store pieces the "badges show up after refresh" fix relies on:
// - addProfileNotice: parses the notice-bot body into the reactive `roomNotices` map.
// - getNoticeUserId: resolves the server-notices mxid once and caches it.
describe('rooms store - room notices', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('addProfileNotice', () => {
		test('parses a single disclosed attribute into roomNotices', () => {
			const rooms = useRooms();
			const body = "@alice:test joined the room with attributes {'pbdf.sidn-pbdf.email.email': 'alice@ru.nl'}";

			rooms.addProfileNotice('!room', body);

			expect(rooms.roomNotices['!room']['@alice:test']).toEqual({
				'pbdf.sidn-pbdf.email.email': 'alice@ru.nl',
			});
		});

		test('parses multiple attributes and drops empty values', () => {
			const rooms = useRooms();
			const body = "@bob:test joined the room with attributes {'pbdf.sidn-pbdf.email.domain': 'ru.nl', 'pbdf.gemeente.personalData.fullname': ''}";

			rooms.addProfileNotice('!room', body);

			// Empty-string values are stripped so they don't render as a badge.
			expect(rooms.roomNotices['!room']['@bob:test']).toEqual({
				'pbdf.sidn-pbdf.email.domain': 'ru.nl',
			});
		});

		test('is keyed per room and per user', () => {
			const rooms = useRooms();
			rooms.addProfileNotice('!room', "@alice:test joined the room with attributes {'a': '1'}");
			rooms.addProfileNotice('!room', "@bob:test joined the room with attributes {'a': '2'}");
			rooms.addProfileNotice('!other', "@alice:test joined the room with attributes {'a': '3'}");

			expect(rooms.roomNotices['!room']['@alice:test']).toEqual({ a: '1' });
			expect(rooms.roomNotices['!room']['@bob:test']).toEqual({ a: '2' });
			expect(rooms.roomNotices['!other']['@alice:test']).toEqual({ a: '3' });
		});
	});

	describe('getNoticeUserId', () => {
		// The store caches the notices mxid in a module-level promise, and clears that cache
		// when the request fails. This single test drives both paths in order because the cache
		// is shared: the rejected call must reset it so the following calls actually re-fetch.
		test('caches on success and clears the cache on error', async () => {
			const rooms = useRooms();
			const spy = vi.spyOn(api_synapse, 'apiGET');

			// 1. Failed request rejects and must NOT leave a cached (rejected) promise behind.
			spy.mockRejectedValueOnce(new Error('boom'));
			await expect(rooms.getNoticeUserId()).rejects.toThrow('boom');

			// 2. After the reset, a successful request is fetched once and then cached.
			spy.mockResolvedValue('@notices_user:test');
			const first = await rooms.getNoticeUserId();
			const second = await rooms.getNoticeUserId();

			expect(first).toBe('@notices_user:test');
			expect(second).toBe('@notices_user:test');
			// 1 rejected + 1 resolved fetch; the second success call is served from cache.
			expect(spy).toHaveBeenCalledTimes(2);
			expect(spy).toHaveBeenCalledWith(api_synapse.apiURLS.notice);
		});
	});

	// Covers the live-update path: sliding sync already delivers the notice-bot message as a
	// timeline entry in roomData, so loadFromSlidingSync picks it up directly instead of needing
	// a separate matrix-js-sdk client listener (see MatrixService).
	describe('loadFromSlidingSync - live room notices', () => {
		test('records attributes for a live notice from the server-notices bot', async () => {
			const rooms = useRooms();
			vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([makeTimelineEvent()]));
			await vi.waitFor(() => expect(rooms.roomNotices[ROOM_ID]).toBeDefined());

			expect(rooms.roomNotices[ROOM_ID]['@alice:test']).toEqual({
				'pbdf.sidn-pbdf.email.email': 'alice@ru.nl',
			});
		});

		test('ignores non-message events', async () => {
			const rooms = useRooms();
			vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([makeTimelineEvent({ type: EventType.RoomMember })]));

			expect(rooms.roomNotices[ROOM_ID]).toBeUndefined();
		});

		test('ignores messages that are not notices', async () => {
			const rooms = useRooms();
			vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([makeTimelineEvent({ msgtype: MsgType.Text })]));

			expect(rooms.roomNotices[ROOM_ID]).toBeUndefined();
		});

		test('ignores notices without the expected marker text', async () => {
			const rooms = useRooms();
			vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([makeTimelineEvent({ body: 'just a regular server notice' })]));

			expect(rooms.roomNotices[ROOM_ID]).toBeUndefined();
		});

		test('ignores notices sent by someone other than the server-notices bot', async () => {
			const rooms = useRooms();
			const spy = vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([makeTimelineEvent({ sender: '@impersonator:test' })]));
			await vi.waitFor(() => expect(spy).toHaveBeenCalled());

			// Body matched, but the sender is not the notices bot, so nothing is recorded.
			expect(rooms.roomNotices[ROOM_ID]).toBeUndefined();
		});

		test('does nothing when the timeline is empty', () => {
			const rooms = useRooms();
			const spy = vi.spyOn(rooms, 'getNoticeUserId');

			rooms.loadFromSlidingSync(ROOM_ID, makeRoomData([]));

			// Never even bothers resolving the notices mxid when there's nothing to check.
			expect(spy).not.toHaveBeenCalled();
		});
	});
});
