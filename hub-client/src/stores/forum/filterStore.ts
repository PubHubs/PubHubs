import { EventType } from 'matrix-js-sdk';
import { defineStore } from 'pinia';

import { EVENT_TYPE_TOPIC, EVENT_TYPE_TOPIC_RATING, EVENT_TYPE_TOPIC_REPLY } from '@hub-client/services/forum/properties';

export enum FILTER_STATE {
	MY_TOPICS = 'my_topics',
	NO = 'no',
}

export const useFilterStore = defineStore('filterStore', {
	state: () => ({
		filter: FILTER_STATE.NO,
		topicsAndReplyFilter: {
			room: {
				timeline: {
					types: [EVENT_TYPE_TOPIC, EVENT_TYPE_TOPIC_REPLY, EVENT_TYPE_TOPIC_RATING, EventType.RoomMessage],
				},
			},
		},
		topicsFilter: {
			room: {
				timeline: {
					types: [EVENT_TYPE_TOPIC, EVENT_TYPE_TOPIC_RATING, EventType.RoomMessage],
				},
			},
		},
		replyFilter: {
			room: {
				timeline: {
					types: [EVENT_TYPE_TOPIC_REPLY, EVENT_TYPE_TOPIC_RATING, EventType.RoomMessage],
				},
			},
		},
	}),
	actions: {
		topicsFilterWithId(userId: string) {
			return {
				room: {
					timeline: {
						types: [EVENT_TYPE_TOPIC, EVENT_TYPE_TOPIC_REPLY, EVENT_TYPE_TOPIC_RATING, EventType.RoomMessage],
						senders: userId ? [userId] : [],
					},
				},
			};
		},
	},
});
