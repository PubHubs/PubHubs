import { PubHubsMgType } from '@hub-client/logic/core/events';

import type { TRating } from '@hub-client/models/events/forum/TRating';

import { BaseForumService } from '@hub-client/services/forum/BaseService';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

//import { useTimelineStore } from '../timelineStore';
//import { EventTimeline } from 'matrix-js-sdk';

export class RatingService extends BaseForumService {
	async sendRatingMessage(eventId: string, rating: string) {
		if (!(rating === 'like' || rating === 'dislike' || rating === 'none')) {
			// eslint-disable-next-line -- temp code
			console.error('Error sending topic rating: rating invalid');
			return;
		}

		const ratingRelation = await this.client.relations(this.room.roomId, eventId, 'm.annotation', PubHubsMgType.ForumTopicRating, { limit: 10 });
		const prior_rating = ratingRelation.events;

		if (prior_rating.length > 0) {
			try {
				// eslint-disable-next-line -- temp code
				console.log('Prior rating length: ', prior_rating.length);
				await usePubhubsStore().deleteMessage(this.room.roomId, prior_rating[0].event.event_id!);
			} catch (error: unknown) {
				// eslint-disable-next-line -- temp code
				console.error('Error deleting topic rating: ', error);
			}
		}

		// no rating needs to be sent when the rating is none
		if (rating === 'none') return;

		const content = {
			msgtype: PubHubsMgType.ForumTopicRating,
			body: rating,
			'm.relates_to': {
				rel_type: 'm.annotation',
				event_id: eventId,
				key: rating,
			},
		};

		// eslint-disable-next-line -- temp code
		console.log('Event Content JSON RATING:', JSON.stringify(content, null, 2));
		// eslint-disable-next-line -- temp code
		await this.client.sendEvent(this.room.roomId, PubHubsMgType.ForumTopicRating as any, content as any);
	}

	getRatingUser(forumRatings: TRating[], eventId: string, user: string) {
		const rating = forumRatings.filter((t) => t['m.relates_to'].event_id === eventId).find((t) => t.author === user);
		return rating ? rating['m.relates_to'].key : 'none';
	}

	private async fetchAllRatingsOnce(): Promise<TRating[]> {
		const roomId = this.room.roomId;
		let from: string | undefined;
		// eslint-disable-next-line -- temp code
		const rawEvents: any[] = [];

		do {
			// Manual request to fetch ratings - As previous attempt did not do so correctly.
			// eslint-disable-next-line -- temp code
			const params: any = {
				from,
				dir: 'b',
				limit: 1000,
				filter: JSON.stringify({ types: [PubHubsMgType.ForumTopicRating] }),
			};
			// eslint-disable-next-line -- temp code
			const resp = await (this.client as any).http.authedRequest('GET', `/rooms/${encodeURIComponent(roomId)}/messages`, params);
			rawEvents.push(...resp.chunk);
			from = resp.end;
		} while (rawEvents.length && rawEvents.length % 1000 === 0); // Paginate if chunk contains exactly 1000 events

		// eslint-disable-next-line -- temp code
		console.log('Fetched total rating events:', rawEvents.length);

		// Remove all the redacted ratings
		const nonRedacted = rawEvents.filter((evt) => evt.content && evt.content['m.relates_to'] && typeof evt.content['m.relates_to'].event_id === 'string');

		return nonRedacted.map((evt) => {
			const rel = evt.content['m.relates_to']!;
			return {
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: rel.event_id,
					key: rel.key,
				},
				body: rel.event_id,
				eventId: evt.event_id!,
				author: evt.sender!,
				timestamp: evt.origin_server_ts!,
			} as TRating;
		});
	}

	async fetchEventRatings(ratingsByEvent: Map<string, { likes: number; dislikes: number }>): Promise<TRating[]> {
		const allRatingsEvents = await this.fetchAllRatingsOnce();

		allRatingsEvents.forEach((evt) => {
			const targetId = evt['m.relates_to'].event_id;
			const accum = ratingsByEvent.get(targetId) ?? { likes: 0, dislikes: 0 };

			if (evt['m.relates_to'].key === 'like') accum.likes++;
			else if (evt['m.relates_to'].key === 'dislike') accum.dislikes++;
			ratingsByEvent.set(targetId, accum);
		});

		return allRatingsEvents;
	}
}
