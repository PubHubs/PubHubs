import { MatrixClient, TimelineWindow } from 'matrix-js-sdk';
import { defineStore } from 'pinia';

import { TMessageEvent, TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';
import type { TRating } from '@hub-client/models/events/forum/TRating';
import type { TThread } from '@hub-client/models/events/forum/TThread';
import Room from '@hub-client/models/rooms/Room';

import { AttachmentService } from '@hub-client/services/forum/AttachmentService';
import { PerformanceTracker } from '@hub-client/services/forum/PerformanceTracker';
import { RatingService } from '@hub-client/services/forum/RatingService';
import { TopicService } from '@hub-client/services/forum/TopicService';

import { SortDirection, SortOptionKey, sortOptions, useSortingStore } from '@hub-client/stores/forum/sortingStore';
import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

export const useForumStore = defineStore('forumStore', {
	state: () => ({
		forumTopics: [] as TThread[],
		myTopics: [] as TThread[], // Topics created by the current user
		forumRatings: [] as TRating[],
		threadIndex: new Map<string, TThread>(), // Add a Map to index all threads by their eventId
		isPosting: false,
		postError: null as Error | null,
		attachmentService: null as AttachmentService | null,
		topicService: null as TopicService | null,
		ratingService: null as RatingService | null,
	}),

	getters: {
		services(): {
			attachment: AttachmentService;
			topic: TopicService;
			rating: RatingService;
		} {
			const timelineStore = useTimelineStore();
			const client = timelineStore.client as MatrixClient;
			const room = timelineStore.room as Room;
			this.attachmentService = this.attachmentService || new AttachmentService(client, room);
			this.ratingService = this.ratingService || new RatingService(client, room);
			this.topicService = this.topicService || new TopicService(client, room, this.ratingService as RatingService);

			return {
				attachment: this.attachmentService as AttachmentService,
				topic: this.topicService as TopicService,
				rating: this.ratingService as RatingService,
			};
		},
	},
	actions: {
		buildThreadIndex() {
			// if (this.threadIndex.size > 0) {
			// 	return;
			// }

			// Force to clear(), because each time we fetch topics, we need to re-index
			// Once we implement 'only new topics are fetched and others are cached' we can remove this
			this.threadIndex.clear();

			// Recursively index all threads and their nested replies
			const indexThread = (thread: TThread) => {
				this.threadIndex.set(thread.eventId, thread);
				if (thread.replies && thread.replies.length > 0) {
					thread.replies.forEach(indexThread);
				}
			};
			this.forumTopics.forEach((t) => indexThread(t as TThread));
		},
		findThreadByEventId(eventId: string): TThread | undefined {
			return this.threadIndex.get(eventId) as TThread | undefined;
		},
		async sendTopic(title: string, description: string, closed: boolean, eventId?: string, originalTitle?: string, originalBody?: string, originalClosed?: boolean) {
			try {
				return await this.services.topic.sendTopicMessage(title, description, closed, eventId, originalTitle, originalBody, originalClosed);
			} catch (error) {
				console.error('Error sending topic:', error);
			}
		},
		async sendReply(parentId: string, description: string, eventId?: string, originalBody?: string) {
			try {
				return await this.services.topic.sendTopicReply(parentId, description, eventId, originalBody);
			} catch (error) {
				console.error('Error sending reply:', error);
			}
		},
		async sendRating(eventId: string, rating: string) {
			try {
				return await this.services.rating.sendRatingMessage(eventId, rating);
			} catch (error) {
				console.error('Error sending rating:', error);
			}
		},
		async sendAttachment(
			event: TLocalAttachmentMessageEventContent,
			parentId: string,
			oldEvent?: TMessageEvent<TMessageEventContent>,
		): Promise<{
			id: string;
			url: string;
		}> {
			try {
				return await this.services.attachment.sendAttachment(event, parentId, oldEvent);
			} catch (error) {
				console.error('Error sending attachment:', error);
				throw error;
			}
		},
		async fetchTopics(tw: TimelineWindow) {
			try {
				const { forumTopics, forumRatings } = await this.services.topic.fetchTopics(tw);
				const sort = useSortingStore();
				let sortOption = sortOptions.find((option) => option.key === SortOptionKey.DATE);
				if (sortOption) {
					forumTopics.sort((a, b) => -1 * sortOption!.sortFn(a, b));
				}
				sortOption = sortOptions.find((option) => option.key === sort.key);
				if (sortOption) {
					if (sort.direction === SortDirection.ASC) {
						forumTopics.sort((a, b) => sortOption.sortFn(a, b));
					} else {
						forumTopics.sort((a, b) => -1 * sortOption.sortFn(a, b));
					}
				}

				// sorting for replies
				for (const topic of forumTopics) {
					const sortOption = sortOptions.find((option) => option.key === SortOptionKey.LIKES);
					topic.replies.reverse(); // by default show newest replies first
					if (sortOption) {
						topic.replies.sort((a, b) => -1 * sortOption!.sortFn(a, b));
					}
				}
				this.forumTopics = forumTopics || [];
				this.forumRatings = forumRatings || [];

				this.buildThreadIndex();
				const perf = PerformanceTracker.getTracker('loadAttachments').start();
				await this.services.attachment.loadAttachments();
				perf.mark('loadAttachments');
				perf.end('Performance Measurements - Attachments');
				console.log('forumTopics length in forumStore: ', forumTopics?.length);
				return forumTopics;
			} catch (error) {
				console.error('Error sending attachment:', error);
			}
		},

		// Could also do with client.relations. As it is just called once when in a TopicItem, there is just one http get request
		// Then you dont have to store this.forumRatings in memory.
		getRatingUser(eventId: string, user: string) {
			return this.services.rating.getRatingUser(this.forumRatings, eventId, user);
		},

		addReplyToTopic(eventId: string, reply: TThread) {
			// Recursive function to add replies to the local this.forumTopics
			const replyTreeWalk = (topics: any[]): boolean => {
				for (const topic of topics) {
					if (topic.eventId === eventId) {
						// Parent
						topic.replies.push(reply);
						return true;
					}
					if (replyTreeWalk(topic.replies)) return true;
				}
				return false; // Child
			};
			if (replyTreeWalk(this.forumTopics)) {
				this.buildThreadIndex();
				return;
			}
		},

		// Might be doing some unneccessary things as well.
		addEditedEventToTopicList(topic: TThread, parentId?: string) {
			// recursively try to replace existing thread
			const replaceIn = (arr: TThread[]): boolean => {
				for (let i = 0; i < arr.length; i++) {
					if (arr[i].eventId === topic.eventId) {
						arr[i] = topic;
						return true;
					}
					if (replaceIn(arr[i].replies)) return true;
				}
				return false;
			};

			// if thread already exists, just update it
			if (replaceIn(this.forumTopics as TThread[])) {
				this.buildThreadIndex();
				return;
			}

			// otherwise insert
			if (parentId) {
				// find parent and push into its replies
				const insertUnder = (arr: TThread[]): boolean => {
					for (const t of arr) {
						if (t.eventId === parentId) {
							t.replies.push(topic);
							return true;
						}
						if (insertUnder(t.replies)) return true;
					}
					return false;
				};
				insertUnder(this.forumTopics as TThread[]);
			} else {
				// top-level topic
				this.forumTopics.push(topic);
			}

			this.buildThreadIndex();
		},

		deleteTopicReply(replyEvent: TThread) {
			this.forumTopics = this.services.topic.deleteTopicReply(replyEvent, this.forumTopics);
			this.buildThreadIndex();
		},

		deleteTopic(topicEvent: TThread) {
			this.forumTopics = this.services.topic.deleteTopic(topicEvent, this.forumTopics);
			this.buildThreadIndex();
		},
	},
});
