import type { MentionMatch, MessageSegment } from '@hub-client/models/components/TMessage';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

/**
 * Composable for detecting and resolving in-text mentions of users and rooms.
 *
 * Supported mention formats:
 * * `@displayName~userId`
 * * `#displayName~roomId`
 *
 * The parser extracts these patterns from a plain-text message body and produces:
 * 1. A structured list of detected mentions (`MentionMatch[]`).
 * 2. A list of message segments (`MessageSegment[]`) mixing normal text and enriched
 *
 */
export function useMentions() {
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();

	/**
	 * Parse a message body to extract valid mention tokens.
	 *
	 * Mention syntax rules:
	 * - A mention begins with either `@` (user) or `#` (room).
	 * - A `~` separates the displayed name from the identifier.
	 * - The identifier continues until the next whitespace or end of message.
	 *
	 * Validation rules:
	 * - User mentions are valid only if `pubhubs.client.getUser(id)` exists.
	 * - Room mentions are valid only if `rooms.getTPublicRoom(id)` exists.
	 *
	 * Example:
	 *   "@Alice~abc123 hello #General~room42"
	 *
	 * @param body The raw message content.
	 * @returns An array of `MentionMatch` describing valid detected mentions.
	 */
	function parseMentions(body: string): MentionMatch[] {
		if (!body) return [];

		const mentions: MentionMatch[] = [];
		let index = 0;

		while (index < body.length) {
			const atPos = body.indexOf('@', index);
			const hashPos = body.indexOf('#', index);
			const atFound = atPos !== -1;
			const hashFound = hashPos !== -1;

			let start = -1;
			let marker: '@' | '#' | null = null;

			if (atFound && atPos < hashPos) {
				start = atPos;
				marker = '@';
			} else if (hashFound) {
				start = hashPos;
				marker = '#';
			}

			// No further markers found → stop
			if (start === -1) break;

			// Determine where the token ends (tilde or space, whichever comes first)
			const tilde = body.indexOf('~', start);
			const space = body.indexOf(' ', start);
			const tildeFound = tilde !== -1;
			const endToken = tildeFound && tilde < space ? tilde : space;
			const hasEndToken = endToken !== -1;
			const tokenEnd = hasEndToken ? body.length : endToken;

			const displayName = body.substring(start, tokenEnd);

			// Identifier extends until the next space or end of string
			const nextSpace = body.indexOf(' ', tokenEnd + 1);
			const id = body.substring(tokenEnd + 1, nextSpace === -1 ? body.length : nextSpace);

			// Validate via known users/rooms
			const isValid = marker === '#' ? !!rooms.getTPublicRoom(id) : !!pubhubs.client.getUser(id);

			if (isValid) {
				mentions.push({
					type: marker,
					start,
					end: nextSpace === -1 ? body.length : nextSpace,
					displayName,
					id: `${id}-${start}`, // unique key for rendering
					tokenId: id,
				});
				index = nextSpace === -1 ? body.length : nextSpace;
			} else {
				// Skip invalid token and continue parsing
				index = start + 1;
			}
		}

		return mentions;
	}
	/**
	 * Converts the message body and parsed mention information into renderable segments.
	 *
	 * Each segment is either:
	 * - `{ type: 'text', content: string }`
	 * - `{ type: 'room', displayName, id, tokenId}`
	 *
	 * Output is ordered and non-overlapping. Normal text between mentions is preserved.
	 *
	 * @param body The original message text.
	 * @param mentions Parsed mention matches from `parseMentions()`.
	 * @returns An array of `MessageSegment` describing how the text should be rendered.
	 */
	function buildSegments(body: string, mentions: MentionMatch[]): MessageSegment[] {
		if (!body) return [{ type: 'text', content: '', id: null }];
		if (!mentions.length) return [{ type: 'text', content: body, id: null }];

		const segments: MessageSegment[] = [];
		let lastIndex = 0;

		mentions.forEach((mention) => {
			// Add text preceding the mention
			if (mention.start > lastIndex) {
				segments.push({
					type: 'text',
					content: body.substring(lastIndex, mention.start),
					id: null,
				});
			}

			// Add enriched mention segment
			if (mention.type === '#') {
				segments.push({
					type: 'room',
					displayName: mention.displayName,
					id: mention.id,
					tokenId: mention.tokenId,
				});
			} else {
				segments.push({
					type: 'user',
					displayName: mention.displayName,
					id: mention.id,
					tokenId: mention.tokenId,
				});
			}

			lastIndex = mention.end;
		});

		// Remaining trailing text
		if (lastIndex < body.length) {
			segments.push({
				type: 'text',
				content: body.substring(lastIndex),
				id: null,
			});
		}

		return segments;
	}

	return {
		parseMentions,
		buildSegments,
	};
}
