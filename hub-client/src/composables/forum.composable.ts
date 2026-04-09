import { PubHubsMgType } from '@hub-client/logic/core/events';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

function useForum() {
	const pubhubs = usePubhubsStore();
	const currentRoom = useRooms().currentRoom;

	const constructTopicContent = (
		title: string,
		body: string,
		closed: boolean,
		// eslint-disable-next-line -- temp code
	): any => {
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

	const sendTopic = async (title: string, description: string, closed: boolean) => {
		const content = constructTopicContent(title, description, closed);
		// eslint-disable-next-line -- temp code
		return await pubhubs.client.sendEvent(currentRoom!.roomId, PubHubsMgType.ForumTopic as any, content as unknown);
	};

	// const transformBack = (item: TThread): unknown => {
	// 	if (item.event) return item.event;
	// 	return item;
	// };

	// const transformTopic = (event: TimelineEvent): TThread | undefined => {
	// 	const eventId = event.matrixEvent.getId()!;
	// 	const content = event.matrixEvent.getContent() as TTopicContent | TTopicReplyContent;
	// 	if (!eventId || !event.matrixEvent.getSender() || !content.body) return undefined;
	// 	// skip edits
	// 	if ('m.new_content' in content) return undefined;

	// 	// const { likes, dislikes } = ratingsByEvent.get(eventId) ?? { likes: 0, dislikes: 0 };
	// 	// const isTopic = event.matrixEvent.getType() === PubHubsMgType.ForumTopic && (content as TTopicContent).ph_topic_title !== '';
	// 	const isTopic = true;
	// 	const user = pubhubs.client.getUser(event.matrixEvent.getSender()!);

	// 	const thread: TThread = {
	// 		event: event,
	// 		eventId: eventId,
	// 		likes: 0,
	// 		dislikes: 0,
	// 		author: user,
	// 		title: isTopic ? (content as TTopicContent).ph_topic_title || '' : '',
	// 		body: isTopic ? (content as TTopicContent).ph_topic_body || content.body : content.body!,
	// 		closed: isTopic ? ((content as TTopicContent).ph_topic_closed ?? false) : false,
	// 		timestamp: event.matrixEvent.getTs(),
	// 		replies: [],
	// 	};
	// 	return thread;
	// };

	// // Threads are with the parent event, so number of replies is one less
	// const addReplies = async (thread: TThread, room: Room): Promise<TThread> => {
	// 	if (thread.replies.length === 0 && nrOfReplies(thread, room) > 0) {
	// 		room?.setCurrentThreadId(thread.eventId);
	// 		const replies = await room?.getCurrentThreadEvents();
	// 		thread.replies = replies.map((r) => transformTopic(r)!);
	// 	}
	// 	return thread;
	// };

	// // Threads are with the parent event, so number of replies is one less
	// const nrOfReplies = (thread: TThread, room: Room): number => {
	// 	let nr = 0;
	// 	if (thread.replies) {
	// 		nr = thread.replies.length;
	// 	} else {
	// 		nr = room?.getCurrentThreadLength();
	// 	}
	// 	if (nr > 0) nr--;
	// 	return 0;
	// };

	return {
		sendTopic,
		// transformBack,
		// transformTopic,
		// addReplies,
		// nrOfReplies,
	};
}
export { useForum };
