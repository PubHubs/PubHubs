import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';

/**
 * A node in the nested comment tree of a forum post.
 * Children are the comments that explicitly replied (m.in_reply_to) to this comment.
 */
interface ForumCommentNode {
	event: TimelineEvent;
	children: ForumCommentNode[];
}

export { type ForumCommentNode };
