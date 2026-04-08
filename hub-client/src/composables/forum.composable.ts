import { PubHubsMgType } from '@hub-client/logic/core/events';

import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { type TThread } from '@hub-client/models/events/forum/TThread';
import { type TTopicContent, type TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
import type Room from '@hub-client/models/rooms/Room';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

function useForum() {
	const pubhubs = usePubhubsStore();
	const currentRoom = useRooms().currentRoom;

	const constructTopicContent = (
		title: string,
		body: string,
		closed: boolean,
		eventId?: string,
		originalTitle?: string,
		originalBody?: string,
		originalClosed?: boolean,
		// eslint-disable-next-line -- temp code
	): any => {
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
	};

	// const constructTopicReply = (body: string, mainTopicId: string, replyToTopicId?: string, originalBody?: string, eventId?: string): any => {
	// 	if (originalBody && eventId) {
	// 		return {
	// 			body: originalBody,
	// 			msgtype: PubHubsMgType.ForumTopicReply,
	// 			'm.new_content': {
	// 				body,
	// 				msgtype: PubHubsMgType.ForumTopicReply,
	// 				'm.mentions': {
	// 					room: false,
	// 					user_ids: [],
	// 				},
	// 				'm.relates_to': {
	// 					'm.in_reply_to': {
	// 						main_event_id: mainTopicId,
	// 						reply_to_event_id: mainTopicId,
	// 					},
	// 				},
	// 			},
	// 			'm.relates_to': {
	// 				rel_type: 'm.replace',
	// 				event_id: eventId,
	// 			},
	// 		};
	// 	}
	// 	return {
	// 		body,
	// 		msgtype: PubHubsMgType.ForumTopicReply,
	// 		['m.mentions']: {
	// 			room: false,
	// 			user_ids: [],
	// 		},
	// 		'm.relates_to': {
	// 			'm.in_reply_to': {
	// 				main_event_id: mainTopicId,
	// 				reply_to_event_id: replyToTopicId,
	// 			},
	// 		},
	// 	};
	// };

	const sendTopic = async (
		title: string,
		description: string,
		closed: boolean,
		eventId?: string,
		originalTitle?: string,
		originalBody?: string,
		originalClosed?: boolean,
	) => {
		const content = constructTopicContent(title, description, closed, eventId, originalTitle, originalBody, originalClosed);
		// eslint-disable-next-line -- temp code
		return await pubhubs.client.sendEvent(currentRoom!.roomId, PubHubsMgType.ForumTopic as any, content as unknown);
	};

	// async sendTopicReply(parentId: string, description: string, eventId?: string, originalBody?: string) {
	// 	let mainTopicId = parentId;
	// 	const pubhubs = usePubhubsStore();
	// 	const parentEvent = await pubhubs.getEvent(this.room.roomId, parentId);
	// 	const parentContent = parentEvent.content as TTopicReplyContent;

	// 	if (!eventId && parentEvent.type === PubHubsMgType.ForumTopicReply && parentContent?.['m.relates_to']?.['m.in_reply_to']?.main_event_id) {
	// 		mainTopicId = parentContent['m.relates_to']['m.in_reply_to'].main_event_id;
	// 	}
	// 	const content = this.constructTopicReply(description, mainTopicId, parentId, originalBody, eventId);
	// 	return await this.client.sendEvent(this.room.roomId, PubHubsMgType.ForumTopicReply as any, content as any);
	// }

	// const sendReply = async (parentId: string, description: string, eventId?: string, originalBody?: string) => {
	// 	let mainTopicId = parentId;
	// 	const parentEvent = await pubhubs.getEvent(currentRoom!.roomId, parentId);
	// 	const parentContent = parentEvent.content as TTopicReplyContent;

	// 	if (!eventId && parentEvent.type === PubHubsMgType.ForumTopicReply && parentContent?.['m.relates_to']?.['m.in_reply_to']?.main_event_id) {
	// 		mainTopicId = parentContent['m.relates_to']['m.in_reply_to'].main_event_id;
	// 	}
	// 	const content = constructTopicReply(description, mainTopicId, parentId, originalBody, eventId);
	// 	// eslint-disable-next-line -- temp code
	// 	return await pubhubs.client.sendEvent(currentRoom!.roomId, PubHubsMgType.ForumTopicReply as any, content as unknown);
	// };

	const transformBack = (item: TThread): unknown => {
		if (item.event) return item.event;
		return item;
	};

	const transformTopic = (event: TimelineEvent): TThread | undefined => {
		const eventId = event.matrixEvent.getId()!;
		const content = event.matrixEvent.getContent() as TTopicContent | TTopicReplyContent;
		if (!eventId || !event.matrixEvent.getSender() || !content.body) return undefined;
		// skip edits
		if ('m.new_content' in content) return undefined;

		// const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
		// const isTopic = event.matrixEvent.getType() === PubHubsMgType.ForumTopic && (content as TTopicContent).ph_topic_title !== '';
		const isTopic = true;
		const user = pubhubs.client.getUser(event.matrixEvent.getSender()!);

		const thread: TThread = {
			event: event,
			eventId: eventId,
			likes: 0,
			dislikes: 0,
			author: user,
			title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
			body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
			closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
			timestamp: event.matrixEvent.getTs(),
			replies: [],
		};
		return thread;
	};

	// Threads are with the parent event, so number of replies is one less
	const addReplies = async (thread: TThread, room: Room): Promise<TThread> => {
		if (thread.replies.length === 0 && nrOfReplies(thread, room) > 0) {
			room?.setCurrentThreadId(thread.eventId);
			const replies = await room?.getCurrentThreadEvents();
			thread.replies = replies.map((r) => transformTopic(r)!);
		}
		return thread;
	};

	// Threads are with the parent event, so number of replies is one less
	const nrOfReplies = (thread: TThread, room: Room): number => {
		let nr = 0;
		if (thread.replies) {
			nr = thread.replies.length;
		} else {
			nr = room?.getCurrentThreadLength();
		}
		if (nr > 0) nr--;
		return 0;
	};

	return {
		sendTopic,
		transformBack,
		transformTopic,
		addReplies,
		nrOfReplies,
	};
}
export { useForum };
