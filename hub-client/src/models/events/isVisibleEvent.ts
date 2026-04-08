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
 */
export function isVisibleEvent(event: Partial<TBaseEvent>, currentUserId: string): boolean {
	if (event.type && !visibleEventTypes.includes(event.type)) return false;

	if (event.content?.msgtype) {
		if (invisibleMessageTypes.includes(event.content.msgtype)) return false;
	}

	if (invisibleRelatesToTypes.includes(event.content?.[RelationType.RelatesTo]?.rel_type)) return false;

	if (event.content?.msgtype === PubHubsMgType.WhisperMessage) {
		const whisperToUserId = event.content?.whisper_to;
		if (!currentUserId || (event.sender !== currentUserId && whisperToUserId !== currentUserId)) return false;
	}

	if (event.unsigned?.redacted_because?.redacts) {
		if (event.unsigned?.redacted_because?.content.reason === Redaction.DeletedFromThread) return false;
	}

	return true;
}
