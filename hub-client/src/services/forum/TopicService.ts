import { EventTimeline, type MatrixClient, type TimelineWindow } from 'matrix-js-sdk';

import { PubHubsMgType } from '@hub-client/logic/core/events';

import { type TRating } from '@hub-client/models/events/forum/TRating';
import type { TThread } from '@hub-client/models/events/forum/TThread';
import { type TTopicContent, type TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
import type Room from '@hub-client/models/rooms/Room';

import { BaseForumService } from '@hub-client/services/forum/BaseService';
import { type RatingService } from '@hub-client/services/forum/RatingService';
import { PAGE_SIZE } from '@hub-client/services/forum/properties';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

export class TopicService extends BaseForumService {
	private ratingService: RatingService;

	constructor(client: MatrixClient, room: Room, ratingService: RatingService) {
		super(client, room);
		this.ratingService = ratingService;
	}

	async sendTopicMessage(
		title: string,
		description: string,
		closed: boolean,
		eventId?: string,
		originalTitle?: string,
		originalBody?: string,
		originalClosed?: boolean,
	) {
		const content = this.constructTopicContent(title, description, closed, eventId, originalTitle, originalBody, originalClosed);
		// eslint-disable-next-line -- temp code
		return await this.client.sendEvent(this.room.roomId, PubHubsMgType.ForumTopic as any, content as any);
	}

	async sendTopicReply(parentId: string, description: string, eventId?: string, originalBody?: string) {
		let mainTopicId = parentId;
		const pubhubs = usePubhubsStore();
		const parentEvent = await pubhubs.getEvent(this.room.roomId, parentId);
		const parentContent = parentEvent.content as TTopicReplyContent;

		if (!eventId && parentEvent.type === PubHubsMgType.ForumTopicReply && parentContent?.['m.relates_to']?.['m.in_reply_to']?.main_event_id) {
			mainTopicId = parentContent['m.relates_to']['m.in_reply_to'].main_event_id;
		}
		const content = this.constructTopicReply(description, mainTopicId, parentId, originalBody, eventId);
		// eslint-disable-next-line -- temp code
		return await this.client.sendEvent(this.room.roomId, PubHubsMgType.ForumTopicReply as any, content as any);
	}

	async fetchTopics(tw: TimelineWindow) {
		await tw.load(undefined, PAGE_SIZE);
		while (tw.canPaginate(EventTimeline.BACKWARDS)) {
			await tw.paginate(EventTimeline.BACKWARDS, PAGE_SIZE * 2);
		}

		while (tw.canPaginate(EventTimeline.FORWARDS)) {
			await tw.paginate(EventTimeline.FORWARDS, PAGE_SIZE * 2);
		}
		const events = tw.getEvents();

		// console.info('topicService all Events', events.length);

		const topicsAndReplies = events?.filter((event) => event.getType() === PubHubsMgType.ForumTopicReply || event.getType() === PubHubsMgType.ForumTopic);
		const ratingsByEvent = new Map<string, { likes: number; dislikes: number }>();
		let forumRatings: TRating[] = [];

		try {
			forumRatings = await this.ratingService.fetchEventRatings(ratingsByEvent);
		} catch (err) {
			// eslint-disable-next-line -- temp code
			console.error('Could not load ratings, continuing without them:', err);
		}

		const totalRatingsProcessed = Array.from(ratingsByEvent.values()).reduce((sum, { likes, dislikes }) => sum + likes + dislikes, 0);
		// eslint-disable-next-line -- temp code
		console.log('total ratings processed', totalRatingsProcessed);

		const threadMap = new Map<string, TThread>();
		const replyBuckets = new Map<string, TThread[]>();

		for (const event of topicsAndReplies) {
			const eventId = event.getId()!;
			const content = event.getContent() as TTopicContent | TTopicReplyContent;
			if (!eventId || !event.getSender() || !content.body) continue;
			// skip edits
			if ('m.new_content' in content) continue;

			const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
			const isTopic = event.getType() === PubHubsMgType.ForumTopic;
			const user = this.client.getUser(event.getSender()!);

			const thread: TThread = {
				eventId: eventId,
				likes,
				dislikes,
				author: user,
				title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
				body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
				closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
				timestamp: event.getTs(),
				replies: [],
			};

			threadMap.set(eventId, thread);

			// find its immediate parent
			// eslint-disable-next-line -- temp code
			const inReply = (content as any)['m.relates_to']?.['m.in_reply_to'];
			if (inReply?.reply_to_event_id) {
				const parent = inReply.reply_to_event_id;
				const arr = replyBuckets.get(parent) || [];
				arr.push(thread);
				replyBuckets.set(parent, arr);
			}
		}

		// Mapping replies to topics
		for (const [parentId, kids] of replyBuckets) {
			const parent = threadMap.get(parentId);
			if (parent) {
				parent.replies.push(...kids);
			}
		}

		// Main topics
		const forumTopics = Array.from(threadMap.values()).filter((t) => t.title !== '');

		// console.log('Total topics and reply events: ', topicsAndReplies.length);
		// console.log('Total topics: ', forumTopics?.length);
		return { forumTopics, forumRatings };
	}

	private constructTopicContent(
		title: string,
		body: string,
		closed: boolean,
		eventId?: string,
		originalTitle?: string,
		originalBody?: string,
		originalClosed?: boolean,
	) {
		if (originalTitle && originalBody && eventId) {
			return {
				ph_topic_title: originalTitle,
				ph_topic_body: originalBody,
				ph_topic_closed: originalClosed,
				body: originalTitle,
				msgtype: PubHubsMgType.ForumTopic,
				'm.new_content': {
					ph_topic_title: title,
					ph_topic_body: body,
					ph_topic_closed: closed,
					body: title,
					msgtype: PubHubsMgType.ForumTopic,
					'm.mentions': {
						room: false,
						user_ids: [],
					},
				},
				'm.relates_to': {
					rel_type: 'm.replace',
					event_id: eventId,
				},
			};
		}
		return {
			ph_topic_title: title,
			ph_topic_body: body,
			ph_topic_closed: closed,
			body: title,
			msgtype: PubHubsMgType.ForumTopic,
			'm.mentions': {
				room: false,
				user_ids: [],
			},
		};
	}

	private constructTopicReply(body: string, mainTopicId: string, replyToTopicId?: string, originalBody?: string, eventId?: string) {
		if (originalBody && eventId) {
			return {
				body: originalBody,
				msgtype: PubHubsMgType.ForumTopicReply,
				'm.new_content': {
					body,
					msgtype: PubHubsMgType.ForumTopicReply,
					'm.mentions': {
						room: false,
						user_ids: [],
					},
					'm.relates_to': {
						'm.in_reply_to': {
							main_event_id: mainTopicId,
							reply_to_event_id: mainTopicId,
						},
					},
				},
				'm.relates_to': {
					rel_type: 'm.replace',
					event_id: eventId,
				},
			};
		}
		return {
			body,
			msgtype: PubHubsMgType.ForumTopicReply,
			['m.mentions']: {
				room: false,
				user_ids: [],
			},
			'm.relates_to': {
				'm.in_reply_to': {
					main_event_id: mainTopicId,
					reply_to_event_id: replyToTopicId,
				},
			},
		};
	}

	// eslint-disable-next-line -- temp code
	deleteTopicReply(replyEvent: TThread, forumTopics: any[]): TThread[] {
		try {
			const pubhubs = usePubhubsStore();
			pubhubs.deleteMessage(this.room.roomId, replyEvent.eventId);

			// only delete attached image/file if they have a real event_id
			if (replyEvent.image?.event_id) {
				this.room.deleteMessage(replyEvent.image);
			}
			if (replyEvent.file?.event_id) {
				this.room.deleteMessage(replyEvent.file);
			}

			// Filter out reply from in-memory list - No re-fetch needed for UI update
			const removeById = (topics: TThread[]): TThread[] =>
				topics
					.filter((topic) => topic.eventId !== replyEvent.eventId)
					.map((topic) => ({
						...topic,
						replies: topic.replies ? removeById(topic.replies) : [],
					}));
			return removeById(forumTopics) as TThread[];
		} catch (error) {
			// eslint-disable-next-line -- temp code
			console.error('Error deleting reply: ', error);
			return forumTopics;
		}
	}

	// eslint-disable-next-line -- temp code
	deleteTopic(topicEvent: TThread, forumTopics: any[]): TThread[] {
		try {
			const pubhubs = usePubhubsStore();

			// Delete topic replies events
			const topicReplies = topicEvent.replies;
			let updatedForumTopics = forumTopics;
			for (const reply of topicReplies) {
				updatedForumTopics = this.deleteTopicReply(reply, updatedForumTopics);
			}

			// only delete attachments if they have a server-side id
			if (topicEvent.image?.event_id) {
				this.room.deleteMessage(topicEvent.image);
			}
			if (topicEvent.file?.event_id) {
				this.room.deleteMessage(topicEvent.file);
			}

			// Delete the topic event
			pubhubs.deleteMessage(this.room.roomId, topicEvent.eventId);

			// Prune from local list
			const pruneTopic = (topics: TThread[]): TThread[] => topics.filter((t) => t.eventId !== topicEvent.eventId);
			return pruneTopic(updatedForumTopics);
		} catch (error) {
			// eslint-disable-next-line -- temp code
			console.error('Error deleting Topic: ', error);
			return forumTopics;
		}
	}
}
