import type { MentionMatch, MessageSegment } from '@hub-client/models/components/TMessage';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

export function useMentions() {
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();

	function parseMentions(body: string): MentionMatch[] {
		if (!body) return [];

		const mentions: MentionMatch[] = [];
		let index = 0;

		while (index < body.length) {
			const atPos = body.indexOf('@', index);
			const hashPos = body.indexOf('#', index);

			let start = -1;
			let marker: '@' | '#' | null = null;

			if (atPos !== -1 && (hashPos === -1 || atPos < hashPos)) {
				start = atPos;
				marker = '@';
			} else if (hashPos !== -1) {
				start = hashPos;
				marker = '#';
			}

			if (start === -1 || marker === null) break;

			const tilde = body.indexOf('~', start);
			const space = body.indexOf(' ', start);
			const endToken = tilde !== -1 && (space === -1 || tilde < space) ? tilde : space;
			const tokenEnd = endToken !== -1 ? endToken : body.length;

			const displayName = body.substring(start, tokenEnd);

			const nextSpace = body.indexOf(' ', tokenEnd + 1);
			const id = body.substring(tokenEnd + 1, nextSpace !== -1 ? nextSpace : body.length);

			const isValid = marker === '#' ? !!rooms.getTPublicRoom(id) : !!pubhubs.client.getUser(id);

			if (isValid) {
				mentions.push({
					type: marker,
					start,
					end: nextSpace !== -1 ? nextSpace : body.length,
					displayName,
					mentionId: `${id}-${start}`,
					id,
				});
				index = nextSpace !== -1 ? nextSpace : body.length;
			} else {
				index = start + 1;
			}
		}

		return mentions;
	}
	function buildSegments(body: string, mentions: MentionMatch[]): MessageSegment[] {
		if (!body) return [{ type: 'text', content: '', id: null }];
		if (!mentions.length) return [{ type: 'text', content: body, id: null }];

		const segments: MessageSegment[] = [];
		let lastIndex = 0;

		mentions.forEach((mention) => {
			// text before mention
			if (mention.start > lastIndex) {
				segments.push({ type: 'text', content: body.substring(lastIndex, mention.start), id: null });
			}

			// the mention itself
			if (mention.type === '#') {
				segments.push({ type: 'room', displayName: mention.displayName, id: mention.mentionId, roomId: mention.id });
			} else {
				segments.push({ type: 'user', displayName: mention.displayName, id: mention.mentionId, userId: mention.id });
			}

			lastIndex = mention.end;
		});

		// remaining text
		if (lastIndex < body.length) {
			segments.push({ type: 'text', content: body.substring(lastIndex), id: null });
		}

		return segments;
	}

	return {
		parseMentions,
		buildSegments,
	};
}
