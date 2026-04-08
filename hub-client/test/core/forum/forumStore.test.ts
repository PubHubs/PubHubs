import { type MatrixClient, type Room, type TimelineWindow } from 'matrix-js-sdk';
import { SortDirection, SortOptionKey, useSortingStore } from '@hub-client/stores/forum/sortingStore';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { type RatingService } from '@hub-client/services/forum/RatingService';
import type { TRating } from '@hub-client/models/events/forum/TRating';
import type { TThread } from '@hub-client/models/events/forum/TThread';
import { useForumStore } from '@hub-client/stores/forum/forumStore';
import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

let mockTopics: TThread[] = [];
const mockRatings: TRating[] = [];

vi.mock('@hub-client/services/forum/TopicService', () => ({
	TopicService: class {
		 
		constructor(_c: MatrixClient, _r: Room, _rs: RatingService) {}
		 
		async fetchTopics(_tw: TimelineWindow) {
			return { forumTopics: mockTopics, forumRatings: mockRatings };
		}
	},
}));

describe('forumStore.vue test', () => {
	let forumStore: ReturnType<typeof useForumStore>;
	let timelineStore: ReturnType<typeof useTimelineStore>;
	let sortingStore: ReturnType<typeof useSortingStore>;

	beforeEach(() => {
		setActivePinia(createPinia());
		forumStore = useForumStore();
		timelineStore = useTimelineStore();
		sortingStore = useSortingStore();
		forumStore.$reset();
		sortingStore.$reset();

		// reset your fake topics for each test
		mockTopics = [
			{ eventId: 'thread_1', title: 'Test', body: 'B', closed: false, author: null, timestamp: 1, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
			{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
		];
	});

	test('sort topics on likes', async () => {
		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toStrictEqual([
			{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
			{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_1', title: 'Test', body: 'B', closed: false, author: null, timestamp: 1, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
		]);
	});

	test('sort topics on likes ASC', async () => {
		sortingStore.direction = SortDirection.ASC;
		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toStrictEqual([
			{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
			{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_1', title: 'Test', body: 'B', closed: false, author: null, timestamp: 1, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
		]);
	});

	test('sort topics on date ASC', async () => {
		sortingStore.key = SortOptionKey.DATE;
		sortingStore.direction = SortDirection.ASC;
		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toStrictEqual([
			{ eventId: 'thread_1', title: 'Test', body: 'B', closed: false, author: null, timestamp: 1, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
			{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
		]);
	});

	test('sort topics on date', async () => {
		sortingStore.key = SortOptionKey.DATE;
		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toStrictEqual([
			{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
			{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
			{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
			{ eventId: 'thread_1', title: 'Test', body: 'B', closed: false, author: null, timestamp: 1, likes: 2, dislikes: 0, replies: [] },
		]);
	});

	test('sort replies on likes', async () => {
		mockTopics = [
			{
				eventId: 'thread_1',
				title: 'Test',
				body: 'B',
				closed: false,
				author: null,
				timestamp: 1,
				likes: 0,
				dislikes: 0,
				replies: [
					{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
					{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
					{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
					{ eventId: 'thread_5', title: 'Test', body: 'B', closed: false, author: null, timestamp: 5, likes: 2, dislikes: 0, replies: [] },
				],
			},
		];

		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toStrictEqual(
			(mockTopics = [
				{
					eventId: 'thread_1',
					title: 'Test',
					body: 'B',
					closed: false,
					author: null,
					timestamp: 1,
					likes: 0,
					dislikes: 0,
					replies: [
						{ eventId: 'thread_4', title: 'Test', body: 'B', closed: false, author: null, timestamp: 4, likes: 4, dislikes: 0, replies: [] },
						{ eventId: 'thread_5', title: 'Test', body: 'B', closed: false, author: null, timestamp: 5, likes: 2, dislikes: 0, replies: [] },
						{ eventId: 'thread_2', title: 'Test', body: 'B', closed: false, author: null, timestamp: 2, likes: 2, dislikes: 0, replies: [] },
						{ eventId: 'thread_3', title: 'Test', body: 'B', closed: false, author: null, timestamp: 3, likes: 0, dislikes: 0, replies: [] },
					],
				},
			]),
		);
	});

	test('fetchTopics includes a newly pushed mock topic', async () => {
		const extra: TThread = { eventId: 'thread_5', title: 'Extra', body: 'X', closed: false, author: null, timestamp: 99, likes: 1, dislikes: 0, replies: [] };
		mockTopics.push(extra);

		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
		expect(forumStore.forumTopics).toContainEqual(extra);
	});

	test('fetchTopics surfaces mock replies under the correct topic', async () => {
		const replyA: TThread = { eventId: 'reply_A', title: 'Re A', body: 'a', closed: false, author: null, timestamp: 10, likes: 0, dislikes: 0, replies: [] };
		const replyB: TThread = { eventId: 'reply_B', title: 'Re B', body: 'b', closed: false, author: null, timestamp: 20, likes: 0, dislikes: 0, replies: [] };
		mockTopics = [{ eventId: 'thread_root', title: 'Root', body: 'R', closed: false, author: null, timestamp: 1, likes: 0, dislikes: 0, replies: [replyA, replyB] }];

		await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);

		expect(forumStore.forumTopics).toHaveLength(1);
		expect(forumStore.forumTopics[0].replies).toEqual([replyB, replyA]); // Earlier topic (B) comes before the later topic (A) during fetch
	});

	describe('sendTopic, sendReply, sendRating, attachments and index utilities', () => {
		let mockSendTopic: ReturnType<typeof vi.fn>;
		let mockSendReply: ReturnType<typeof vi.fn>;
		let mockSendRating: ReturnType<typeof vi.fn>;
		let mockSendAttachment: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			mockSendTopic = vi.fn().mockResolvedValue({ event_id: 'evt123' });
			mockSendReply = vi.fn().mockResolvedValue({ event_id: 'rpl456' });
			mockSendRating = vi.fn().mockResolvedValue({});
			mockSendAttachment = vi.fn().mockResolvedValue({ id: 'att789', url: 'url' });

			forumStore.topicService = { sendTopicMessage: mockSendTopic, sendTopicReply: mockSendReply } as any;
			forumStore.ratingService = { sendRatingMessage: mockSendRating, getRatingUser: () => 'like' } as any;
			forumStore.attachmentService = { sendAttachment: mockSendAttachment, loadAttachments: vi.fn() } as any;
		});

		test('sendTopic calls TopicService.sendTopicMessage and returns event', async () => {
			const result = await forumStore.sendTopic('T1', 'B1', true, 'origId', 'OT', 'OB', false);
			expect(mockSendTopic).toHaveBeenCalledWith('T1', 'B1', true, 'origId', 'OT', 'OB', false);
			expect(result).toEqual({ event_id: 'evt123' });
		});

		test('sendReply calls TopicService.sendTopicReply and returns event', async () => {
			const result = await forumStore.sendReply('parent', 'reply-body');
			expect(mockSendReply).toHaveBeenCalledWith('parent', 'reply-body', undefined, undefined);
			expect(result).toEqual({ event_id: 'rpl456' });
		});

		test('sendRating calls RatingService.sendRatingMessage', async () => {
			await forumStore.sendRating('evt42', 'like');
			expect(mockSendRating).toHaveBeenCalledWith('evt42', 'like');
		});

		test('sendAttachment calls AttachmentService.sendAttachment and returns data', async () => {
			const data = { foo: 'bar' } as any;
			mockSendAttachment.mockResolvedValueOnce(data);
			const result = await forumStore.sendAttachment({} as any, 'parentId');
			expect(mockSendAttachment).toHaveBeenCalledWith({} as any, 'parentId', undefined);
			expect(result).toBe(data);
		});

		test('getRatingUser proxies to RatingService.getRatingUser', () => {
			forumStore.forumRatings = [
				{
					eventId: 'evt1',
					author: 'u1',
					body: '',
					timestamp: 0,
					'm.relates_to': {
						rel_type: 'm.rating',
						event_id: 'evt1',
						key: 'like',
					},
				},
			];
			const r = forumStore.getRatingUser('evt1', 'u1');
			expect(r).toBe('like');
		});

		test('buildThreadIndex and findThreadByEventId work for nested replies', () => {
			// top-level topic
			const top: TThread = { eventId: 't1', title: '', body: '', closed: false, author: null, timestamp: 0, likes: 0, dislikes: 0, replies: [] };
			forumStore.forumTopics = [top];
			forumStore.buildThreadIndex();
			expect(forumStore.findThreadByEventId('t1')).toStrictEqual(top);

			// add reply
			const reply: TThread = { eventId: 'r1', title: '', body: '', closed: false, author: null, timestamp: 0, likes: 0, dislikes: 0, replies: [] };
			forumStore.addReplyToTopic('t1', reply);
			expect(forumStore.findThreadByEventId('r1')).toStrictEqual(reply);
		});
	});
});
