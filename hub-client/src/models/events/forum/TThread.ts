import { User as MatrixUser } from 'matrix-js-sdk';

import { TMessageEvent, TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';

export type TThread = {
	eventId: string;
	likes: number;
	dislikes: number;
	author: MatrixUser | null;
	title: string;
	closed: boolean;
	body: string;
	timestamp: number;
	replies: TThread[];
	image?: TMessageEvent<TMessageEventContent>;
	file?: TMessageEvent<TMessageEventContent>;
	event?: TimelineEvent;
};
