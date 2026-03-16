import { TMessageEvent, TMessageEventContent } from '@/model/events/TMessageEvent';
import { User as MatrixUser } from 'matrix-js-sdk';

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
};
