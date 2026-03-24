import { EventType } from 'matrix-js-sdk';
import { defineStore } from 'pinia';

import { PubHubsMgType } from '@hub-client/logic/core/events';

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
					types: [PubHubsMgType.ForumTopic, PubHubsMgType.ForumTopicReply, PubHubsMgType.ForumTopicRating, EventType.RoomMessage],
				},
			},
		},
		topicsFilter: {
			room: {
				timeline: {
					types: [PubHubsMgType.ForumTopic, PubHubsMgType.ForumTopicRating, EventType.RoomMessage],
				},
			},
		},
		replyFilter: {
			room: {
				timeline: {
					types: [PubHubsMgType.ForumTopicReply, PubHubsMgType.ForumTopicRating, EventType.RoomMessage],
				},
			},
		},
	}),
	actions: {
		topicsFilterWithId(userId: string) {
			return {
				room: {
					timeline: {
						types: [PubHubsMgType.ForumTopic, PubHubsMgType.ForumTopicReply, PubHubsMgType.ForumTopicRating, EventType.RoomMessage],
						senders: userId ? [userId] : [],
					},
				},
			};
		},
	},
});
