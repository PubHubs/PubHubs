// Models
import { RelationType } from '@hub-client/models/constants';
import { type TTextMessageEventContent } from '@hub-client/models/events/TMessageEvent';

// Types
type TEditableEvent = { content?: Record<string, unknown>; sender?: string };
type TEditEvent = TEditableEvent & { origin_server_ts?: number };

/**
 * Merges an m.replace edit into the content of its target event.
 * The original relation is kept, so replies and threads keep their context.
 * @param target Event being edited
 * @param edit The m.replace event
 * @returns The edited content, or undefined when the edit does not apply (sender mismatch, no `m.new_content`, or this or a newer edit was already applied)
 */
const editedContent = (target: TEditableEvent, edit: TEditEvent): TTextMessageEventContent | undefined => {
	if (edit.sender !== target.sender) return undefined;

	const currentContent = target.content as TTextMessageEventContent | undefined;
	const editTs = edit.origin_server_ts ?? 0;
	if (currentContent?.ph_edited_ts !== undefined && currentContent.ph_edited_ts >= editTs) return undefined;

	const newContent = edit.content?.['m.new_content'] as TTextMessageEventContent | undefined;
	if (!newContent) return undefined;

	const originalRelatesTo = currentContent?.[RelationType.RelatesTo];
	return {
		...newContent,
		...(originalRelatesTo ? { [RelationType.RelatesTo]: originalRelatesTo } : {}),
		ph_edited_ts: editTs,
	};
};

/**
 * Returns the event with the edit applied, leaving the input untouched. Returns the event itself when the edit does not apply.
 * @param target Event being edited
 * @param edit The m.replace event, if any
 */
const withEdit = <T extends TEditableEvent>(target: T, edit: TEditEvent | undefined): T => {
	const content = edit && editedContent(target, edit);
	return content ? { ...target, content } : target;
};

export { editedContent, withEdit };
