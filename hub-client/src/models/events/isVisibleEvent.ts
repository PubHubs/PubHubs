// Packages
import { EventType, MsgType } from 'matrix-js-sdk';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import { Redaction, RelationType } from '@hub-client/models/constants';
import type { TBaseEvent } from '@hub-client/models/events/TBaseEvent';

const visibleEventTypes: string[] = [EventType.RoomMessage];
const invisibleMessageTypes: string[] = [MsgType.Notice];
const invisibleRelatesToTypes: string[] = [RelationType.Thread];

/**
 * Determines whether an event is "visible": rendered in the timeline and
 * eligible for read receipts. This is the single source of truth used by
 * both the TimelineManager (for rendering) and Room.unreadState() (for
 * unread/unknown dot computation).
 *
 * Visible events are m.room.message events that are not:
 * - notices
 * - thread replies
 * - whispers to other users
 * - redacted thread events
 * - hide-message moderation events (which mark another event as hidden)
 */
export function isVisibleEvent(event: Partial<TBaseEvent>, currentUserId: string | null): boolean {
	if (event.type && !visibleEventTypes.includes(event.type)) return false;

	// Loosely-typed view of event.content. The strict TBaseEvent.content is Record<string, unknown>,
	// which prevents nested property access like content[RelatesTo].rel_type without casts everywhere.
	const content = event.content as
		| {
				msgtype?: string;
				whisper_to?: string;
				[RelationType.RelatesTo]?: { rel_type?: string };
		  }
		| undefined;

	if (content?.msgtype && invisibleMessageTypes.includes(content.msgtype)) return false;

	// Hide-message moderation events mark another event as hidden; they are never themselves rendered.
	if (content?.msgtype === PubHubsMgType.HideMessage) return false;

	const relatesToRelType = content?.[RelationType.RelatesTo]?.rel_type;
	if (relatesToRelType && invisibleRelatesToTypes.includes(relatesToRelType)) return false;

	if (content?.msgtype === PubHubsMgType.WhisperMessage) {
		// currentUserId may be null if we have not finished authenticating yet; treat all whispers as
		// invisible in that case (we can't verify they're for us). This matches the pre-extraction behaviour.
		if (!currentUserId || (event.sender !== currentUserId && content.whisper_to !== currentUserId)) return false;
	}

	if (event.unsigned?.redacted_because?.redacts) {
		if (event.unsigned?.redacted_because?.content.reason === Redaction.DeletedFromThread) return false;
	}

	return true;
}
