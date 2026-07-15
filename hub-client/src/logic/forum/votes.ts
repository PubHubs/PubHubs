// Packages
import { EventType, type MatrixEvent } from 'matrix-js-sdk';

// Models
import { RelationType } from '@hub-client/models/constants';
import type Room from '@hub-client/models/rooms/Room';

/**
 * Post votes are plain emoji reactions (m.annotation) with fixed keys, so they ride on the
 * existing reaction system and stay compatible with other Matrix clients.
 */
enum VoteKey {
	Up = '👍',
	Down = '👎',
}

/**
 * All non-redacted vote reactions on an event, deduplicated by reaction event id.
 */
function getVoteEvents(room: Room, eventId: string): MatrixEvent[] {
	const seen = new Set<string>();
	return room
		.getRelatedEventsByType(eventId, { eventType: EventType.Reaction, contentRelType: RelationType.Annotation })
		.map((event) => event.matrixEvent as MatrixEvent)
		.filter((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			const reactionEventId = event.getId();
			if (!reactionEventId || seen.has(reactionEventId)) return false;
			seen.add(reactionEventId);
			return (
				relatesTo?.event_id === eventId &&
				(relatesTo?.key === VoteKey.Up || relatesTo?.key === VoteKey.Down) &&
				!event.isRedacted() &&
				!room.inRedactedMessageIds(reactionEventId)
			);
		});
}

/**
 * The distinct users that voted up and down in a set of vote events (one vote per user per
 * direction; the server rejects duplicate annotations anyway). Takes the events rather than
 * fetching them, so a caller that already holds them does not look them up twice.
 */
function tallyVotes(events: MatrixEvent[]): { up: Set<string>; down: Set<string> } {
	const up = new Set<string>();
	const down = new Set<string>();
	for (const event of events) {
		const sender = event.getSender();
		if (!sender) continue;
		if (event.getContent()[RelationType.RelatesTo]?.key === VoteKey.Up) {
			up.add(sender);
		} else {
			down.add(sender);
		}
	}
	return { up, down };
}

/**
 * The distinct users that voted an event up and down.
 */
function getVoters(room: Room, eventId: string): { up: Set<string>; down: Set<string> } {
	return tallyVotes(getVoteEvents(room, eventId));
}

/**
 * Vote score of an event: upvoters minus downvoters.
 */
function getVoteScore(room: Room, eventId: string): number {
	const voters = getVoters(room, eventId);
	return voters.up.size - voters.down.size;
}

export { VoteKey, getVoteEvents, getVoters, getVoteScore, tallyVotes };
