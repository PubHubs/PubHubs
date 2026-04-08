import { EventType, MsgType, type User } from 'matrix-js-sdk';

import { createLogger } from '@hub-client/logic/logging/Logger';

import { type TFileMessageEventContent, type TImageMessageEventContent, type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
import { type TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';
import { type TThread } from '@hub-client/models/events/forum/TThread';

import { useForumStore } from '@hub-client/stores/forum/forumStore';

const logger = createLogger('forumHelpers');

// Instead of using the listener we make use of dummyEvents and add this to our local list containing the topics and replies
// We do not have enough time to change this to use this listener implemtation.
export function createDummyImage(id: string, url: string, image: TLocalAttachmentMessageEventContent): TMessageEvent<TImageMessageEventContent> {
	return {
		type: EventType.RoomMessage,
		event_id: id,
		origin_server_ts: 0,
		room_id: '',
		sender: '',
		content: {
			msgtype: MsgType.Image,
			url: url,
			body: image!.file.name,
			info: { mimetype: image!.file.type, size: image!.file.size },
		},
	};
}

export function createDummyFile(id: string, url: string, file: TLocalAttachmentMessageEventContent): TMessageEvent<TFileMessageEventContent> {
	return {
		type: EventType.RoomMessage,
		event_id: id,
		origin_server_ts: 0,
		room_id: '',
		sender: '',
		content: {
			msgtype: MsgType.File,
			url: url,
			filename: file?.file.name,
			body: file!.file.name,
			info: { mimetype: file!.file.type, size: file!.file.size },
		},
	};
}

export function createDummyEvent(
	editEvent: boolean, // If not editEvent, then its adding a reply
	eventId: string,
	body: string,
	newTitle?: string,
	author?: User,
	dummyImage?: TMessageEvent<TImageMessageEventContent>,
	dummyFile?: TMessageEvent<TFileMessageEventContent>,
): TThread {
	if (editEvent) {
		const forumStore = useForumStore();
		const oldEvent: TThread = forumStore.findThreadByEventId(eventId)!;

		logger.info('oldEvent', eventId, oldEvent);

		return {
			...oldEvent,
			title: newTitle ?? oldEvent.title,
			body,
			timestamp: Date.now(),
			replies: oldEvent ? oldEvent.replies : [],
			image: dummyImage ?? oldEvent.image,
			file: dummyFile ?? oldEvent.file,
		};
	}
	return {
		eventId: eventId,
		likes: 0,
		dislikes: 0,
		author: author ?? null,
		title: '',
		closed: false,
		body,
		timestamp: Date.now(),
		replies: [],
		image: dummyImage,
		file: dummyFile,
	};
}

export function createDummyEventTopic(
	editEvent: boolean, // If not editEvent, then its adding a reply
	topic: TThread,
	body: string,
	newTitle?: string,
	author?: User,
	dummyImage?: TMessageEvent<TImageMessageEventContent>,
	dummyFile?: TMessageEvent<TFileMessageEventContent>,
): TThread {
	if (editEvent) {
		// const forumStore = useForumStore();
		const eventId = topic.eventId;
		const oldEvent: TThread = topic;

		logger.info('oldEvent', eventId, oldEvent);

		return {
			...oldEvent,
			title: newTitle ?? oldEvent.title,
			body,
			timestamp: Date.now(),
			replies: oldEvent ? oldEvent.replies : [],
			image: dummyImage ?? oldEvent.image,
			file: dummyFile ?? oldEvent.file,
		};
	}
	return {
		eventId: topic.eventId,
		likes: 0,
		dislikes: 0,
		author: author ?? null,
		title: '',
		closed: false,
		body,
		timestamp: Date.now(),
		replies: [],
		image: dummyImage,
		file: dummyFile,
	};
}
