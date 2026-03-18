import { IRelationsRequestOpts, MatrixClient } from 'matrix-js-sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { EVENT_TYPE_TOPIC_RATING } from '@hub-client/services/forum/properties';
import { RatingService } from '@hub-client/services/forum/RatingService';
import Room from '@hub-client/models/rooms/Room';
import { TRating } from '@hub-client/models/events/forum/TRating';

let mockEvents: any = [];
let sentEvent: any = {};
let deletedEvent: any = {};
const mockRoomId: string = 'room1';

vi.mock('matrix-js-sdk', async (importOriginal) => {
	const actual = await importOriginal<typeof import('matrix-js-sdk')>();
	return {
		...actual,
		MatrixClient: class {
			public http: any;

			constructor() {
				this.http = {
					// eslint-disable-next-line
					authedRequest(_type: string, _url: string, _body: string) {
						const temp = mockEvents;
						return { chunk: temp, headers: {}, code: {} };
					},
				};
			}

			// eslint-disable-next-line
			relations(roomId: string, eventId: string, _relationType: string, _eventType: string, _opts?: IRelationsRequestOpts) {
				return eventId === 'event2' && roomId === mockRoomId
					? {
							events: [
								{
									content: {
										'm.relates_to': {
											rel_type: 'm.annotation',
											event_id: 'event2',
											key: 'dislike',
										},
										body: '',
									},
									event: {
										event_id: 'event2rating',
										sender: 'user1',
										origin_server_ts: 12343,
									},
								},
							],
						}
					: { events: [] };
			}

			// eslint-disable-next-line
			sendEvent(roomId: string, eventType: any, content: any, _txnId?: string) {
				sentEvent = { roomId: roomId, eventType: eventType, content: content };
			}
		},
	};
});

vi.mock('@hub-client/stores/pubhubsStore', () => ({
	usePubHubs: () => {
		return {
			deleteMessage: (roomId: string, eventId: string) => {
				deletedEvent = { roomId: roomId, eventId: eventId };
			},
		};
	},
}));

describe('RatingService.vue test', () => {
	setActivePinia(createPinia());
	const client = new MatrixClient({ baseUrl: 'localhost' });
	const room = { roomId: mockRoomId } as Room;
	const ratingService = new RatingService(client, room);

	beforeEach(() => {
		sentEvent = {};
		deletedEvent = {};
	});

	test('sendRatingMessage() with none rating', async () => {
		await ratingService.sendRatingMessage('event1', 'none');
		expect(sentEvent).toEqual({});
	});

	test('sendRatingMessage() with likes/dislikes', async () => {
		await ratingService.sendRatingMessage('event1', 'like');
		expect(sentEvent).toEqual({
			roomId: mockRoomId,
			eventType: EVENT_TYPE_TOPIC_RATING,
			content: {
				msgtype: EVENT_TYPE_TOPIC_RATING,
				body: 'like',
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event1',
					key: 'like',
				},
			},
		});

		await ratingService.sendRatingMessage('event3', 'dislike');
		expect(sentEvent).toEqual({
			roomId: mockRoomId,
			eventType: EVENT_TYPE_TOPIC_RATING,
			content: {
				msgtype: EVENT_TYPE_TOPIC_RATING,
				body: 'dislike',
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event3',
					key: 'dislike',
				},
			},
		});
	});

	// test('sendRatingMessage() replacing an existing rating', async () => {
	// 	await ratingService.sendRatingMessage('event2', 'like');
	// 	expect(deletedEvent).toEqual({ roomId: mockRoomId, eventId: 'event2rating' });
	// 	expect(sentEvent).toEqual({
	// 		roomId: mockRoomId,
	// 		eventType: EVENT_TYPE_TOPIC_RATING,
	// 		content: {
	// 			msgtype: EVENT_TYPE_TOPIC_RATING,
	// 			body: 'like',
	// 			'm.relates_to': {
	// 				rel_type: 'm.annotation',
	// 				event_id: 'event2',
	// 				key: 'like',
	// 			},
	// 		},
	// 	});
	// });

	test('getRatingUser() function test', () => {
		const mockRatings: TRating[] = [
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event1',
					key: 'like',
				},
				eventId: '123',
				author: 'user1',
				body: '',
				timestamp: 12343,
			},
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event3',
					key: 'like',
				},
				eventId: '123',
				author: 'user1',
				body: '',
				timestamp: 12344,
			},
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event3',
					key: 'dislike',
				},
				eventId: '123',
				author: 'user2',
				body: '',
				timestamp: 12345,
			},
		];
		expect(ratingService.getRatingUser(mockRatings, 'event1', 'user1')).toBe('like');
		expect(ratingService.getRatingUser(mockRatings, 'event1', 'user2')).toBe('none');
		expect(ratingService.getRatingUser(mockRatings, 'event3', 'user1')).toBe('like');
		expect(ratingService.getRatingUser(mockRatings, 'event3', 'user2')).toBe('dislike');
		expect(ratingService.getRatingUser(mockRatings, 'event2', 'user1')).toBe('none');
	});

	test('fetchEventRatings() function test', async () => {
		mockEvents = [
			{
				content: {
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: 'event1',
						key: 'like',
					},
					body: '',
				},
				event_id: '121',
				sender: 'user1',
				origin_server_ts: 12343,
			},
			{
				content: {
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: 'event3',
						key: 'like',
					},
					body: '',
				},
				event_id: '122',
				sender: 'user1',
				origin_server_ts: 12344,
			},
			{
				content: {},
				event_id: '123',
				sender: 'user2',
				origin_server_ts: 12335,
			},
			{
				content: {
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: 'event3',
						key: 'dislike',
					},
					body: '',
				},
				event_id: '124',
				sender: 'user2',
				origin_server_ts: 12345,
			},
		];

		const map = new Map<string, { likes: number; dislikes: number }>();
		const ratings = await ratingService.fetchEventRatings(map);
		expect(ratings).toEqual([
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event1',
					key: 'like',
				},
				eventId: '121',
				author: 'user1',
				body: 'event1',
				timestamp: 12343,
			},
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event3',
					key: 'like',
				},
				eventId: '122',
				author: 'user1',
				body: 'event3',
				timestamp: 12344,
			},
			{
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: 'event3',
					key: 'dislike',
				},
				eventId: '124',
				author: 'user2',
				body: 'event3',
				timestamp: 12345,
			},
		]);
		const mockMap = new Map<string, { likes: number; dislikes: number }>();
		mockMap.set('event1', { likes: 1, dislikes: 0 });
		mockMap.set('event3', { likes: 1, dislikes: 1 });
		expect(map).toEqual(mockMap);
	});
});
