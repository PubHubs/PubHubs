import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { TThread } from '@hub-client/models/events/forum/TThread';
import { TTopicContent, TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
import Room from '@hub-client/models/rooms/Room';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

function useForum() {
	const pubhubs = usePubhubsStore();

	const transformBack = (item: TThread): any => {
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

	const addReplies = async (thread: TThread, room: Room): Promise<TThread> => {
		if (thread.replies.length > 0) return thread;
		room?.setCurrentThreadId(thread.eventId);
		const replies = await room?.getCurrentThreadEvents();
		thread.replies = replies.map((r) => transformTopic(r)!);
		return thread;
	};

	const nrOfReplies = (thread: TThread, room: Room): number => {
		if (thread.replies) return thread.replies.length;
		return room?.getCurrentThreadLength() ?? 0;
	};

	return {
		transformBack,
		transformTopic,
		addReplies,
		nrOfReplies,
	};
}
export { useForum };
