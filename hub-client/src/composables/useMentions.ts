// Models
import type { MentionMatch, MessageSegment } from '@hub-client/models/components/TMessage';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

/**
 * Composable for detecting and resolving in-text mentions of users and rooms.
 *
 * Supported mention formats:
 * * `@displayName~userId~`
 * * `#displayName~roomId~`
 *
 * `parseMentions` extracts these patterns from a plain-text message body:
 * - A list of detected mentions (`MentionMatch[]`).
 *
 * `buildSegments` uses the `parseMentions` output to generate:
 * - A list of message segments (`MessageSegment[]`) mixing normal text and mentions.
 *
 * `formatMentions` uses `parseMentions` and `buildSegments` to:
 *  - Reconstruct the full message string with mentions replaced by their display names
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
	 * - A second `~` indicates the end of the identifier.
	 *
	 * Validation rules:
	 * - User mentions are valid only if `pubhubs.client.getUser(id)` exists.
	 * - Room mentions are valid only if `rooms.getTPublicRoom(id)` exists.
	 *
	 * Example:
	 *   "hi `@Name~@f6b-392:testhub.matrix.host~` , come join `#Test~!kUroOyLPHNRGNWtWyE:testhub.matrix.host~`"
	 *
	 * @param body The raw message content.
	 * @returns An array of `MentionMatch` describing valid detected mentions.
	 */
	function parseMentions(body: string): MentionMatch[] {
		if (!body) return [];

		const mentions: MentionMatch[] = [];

		// Matches: @displayName~userId~ or #displayName~roomId~
		const mentionRegex = /([@#])([^~]+)~([^~]+)~/g;

		let match;
		while ((match = mentionRegex.exec(body))) {
			const marker = match[1] as '@' | '#';
			const id = match[3];
			const start = match.index;
			const end = start + match[0].length;

			// Validate
			const tokenName = marker === '#' ? rooms.getTPublicRoom(id)?.name : pubhubs.client.getUser(id)?.rawDisplayName;

			if (tokenName) {
				mentions.push({
					type: marker,
					start,
					end,
					displayName: marker + tokenName,
					id: `${id}-${start}`,
					tokenId: id,
				});
			}
		}

		return mentions;
	}
	/**
	 * * Reconstructs the full message string with mentions replaced by their display names.
	 *
	 * Example:
	 *   Input:
	 *    - "Hello `@Name~@f6b-392:testhub.matrix.host~`, welcome to `#Test~!kUroOyLPHNRGNWtWyE:testhub.matrix.host~`"
	 *
	 *   Output:
	 *    - "Hello `@Name, welcome to #Test`"
	 * @param body The raw message body.
	 * @returns A string in which all valid mentions are replaced with their display name.
	 */
	function formatMentions(body: string): string {
		const mentions = parseMentions(body);
		const segments = buildSegments(body, mentions);
		return segments.map((segment) => segment.content).join('');
	}

	return {
		parseMentions,
		buildSegments,
		formatMentions,
	};
}
/**
 * Converts the message body and parsed mention information into renderable segments.
 *
 * Each segment is either:
 * - `{ type: 'text', content: string }`
 * - `{ type: 'room', displayName, id, tokenId}`
 * - `{ type: 'user', displayName, id, tokenId}`
 *
 * The output is ordered and non-overlapping. Normal text between mentions is preserved.
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
				content: mention.displayName,
				id: mention.id,
				tokenId: mention.tokenId,
			});
		} else {
			segments.push({
				type: 'user',
				content: mention.displayName,
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
