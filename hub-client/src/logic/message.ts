import { MentionMatch } from '@hub-client/models/components/TMessage';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

const rooms = useRooms();
const pubhubs = usePubhubsStore();

/**
 * Find all mentions (for both room and user) in the message body
 */
function findAllMentions(body: string): MentionMatch[] {
	if (!body) return [];

	const mentions: MentionMatch[] = [];

	// Find room mentions (#)
	let index = 0;
	while (index < body.length) {
		const hashIndex = body.indexOf('#', index);
		if (hashIndex === -1) break;

		// Find end of token (~ or space)
		const tilde = body.indexOf('~', hashIndex);
		const space = body.indexOf(' ', hashIndex);
		const endToken = tilde !== -1 && (space === -1 || tilde < space) ? tilde : space;
		const tokenEnd = endToken !== -1 ? endToken : body.length;

		// Extract room ID
		const nextSpace = body.indexOf(' ', tokenEnd + 1);
		const roomId = body.substring(tokenEnd + 1, nextSpace !== -1 ? nextSpace : body.length);

		const room = rooms.getTPublicRoom(roomId);
		if (room) {
			mentions.push({
				type: 'room',
				start: hashIndex,
				end: nextSpace !== -1 ? nextSpace : body.length,
				displayName: `#${room.name}`,
				id: `room-${roomId}-${hashIndex}`,
				roomId: roomId,
			});
			index = nextSpace !== -1 ? nextSpace : body.length;
		} else {
			index = hashIndex + 1;
		}
	}

	// Find user mentions (@)
	index = 0;
	while (index < body.length) {
		const atIndex = body.indexOf('@', index);
		if (atIndex === -1) break;

		// Find end of token (~ or space)
		const tilde = body.indexOf('~', atIndex);
		const space = body.indexOf(' ', atIndex);
		const endToken = tilde !== -1 && (space === -1 || tilde < space) ? tilde : space;
		const tokenEnd = endToken !== -1 ? endToken : body.length;

		const displayName = body.substring(atIndex, tokenEnd);

		// Extract user ID
		const nextSpace = body.indexOf(' ', tokenEnd + 1);
		const userId = body.substring(tokenEnd + 1, nextSpace !== -1 ? nextSpace : body.length);

		if (pubhubs.client.getUser(userId)) {
			mentions.push({
				type: 'user',
				start: atIndex,
				end: nextSpace !== -1 ? nextSpace : body.length,
				displayName: displayName,
				id: `user-${userId}-${atIndex}`,
				userId: userId,
			});
			index = nextSpace !== -1 ? nextSpace : body.length;
		} else {
			index = atIndex + 1;
		}
	}

	// Sort by start position
	return mentions.sort((a, b) => a.start - b.start);
}
export { findAllMentions };
