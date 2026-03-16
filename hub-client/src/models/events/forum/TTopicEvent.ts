import { TMentions } from '@hub-client/models/events/TMessageEvent';

interface BaseContent {
	body: string;
	msgtype: string;
	'm.mentions': TMentions;
}

export interface TTopicContent extends BaseContent {
	ph_topic_title: string;
	ph_topic_body: string;
	ph_topic_closed: boolean;
}

export interface TTopicReplyContent extends BaseContent {
	'm.relates_to'?: {
		'm.in_reply_to'?: {
			main_event_id: string;
			reply_to_event_id?: string; // For 3rd(+) layers
		};
	};
}
