import { EventType, type ISendEventResponse, MsgType } from 'matrix-js-sdk';

import { fileUpload } from '@hub-client/composables/fileUpload';
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

import {
	type TFileMessageEventContent,
	type TImageMessageEventContent,
	type TMessageEvent,
	type TMessageEventContent,
} from '@hub-client/models/events/TMessageEvent';
import { type TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

import { BaseForumService } from '@hub-client/services/forum/BaseService';

import { useForumStore } from '@hub-client/stores/forum/forumStore';
import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

export class AttachmentService extends BaseForumService {
	async loadAttachments() {
		const events = useTimelineStore().tw?.getEvents();
		const attachments = events?.filter((event) => {
			const content = event.getContent();
			return (content.msgtype === MsgType.Image || content.msgtype === MsgType.File) && !('m.new_content' in content);
		});

		attachments?.forEach((attachment) => {
			const content = attachment.getContent();
			const parent_id = content['m.relates_to']?.['m.in_reply_to']?.event_id;
			if (!parent_id) return;
			const t = useForumStore().findThreadByEventId(parent_id);
			if (!t) return;

			const messageEvent = {
				content: content,
				type: EventType.RoomMessage,
				event_id: attachment.event.event_id,
			};
			if (content.msgtype === MsgType.Image) {
				t.image = messageEvent as TMessageEvent<TImageMessageEventContent>;
			} else if (content.msgtype === MsgType.File) {
				t.file = messageEvent as TMessageEvent<TFileMessageEventContent>;
			}
		});
	}

	/**
	 * Uploads and sends an attachment to the room
	 * @returns the uploaded URL
	 */
	async sendAttachment(
		event: TLocalAttachmentMessageEventContent,
		parentId: string,
		oldEvent?: TMessageEvent<TMessageEventContent>,
	): Promise<{
		id: string;
		url: string;
	}> {
		const { allTypes, uploadUrl } = useMatrixFiles();
		const accessToken = usePubhubsStore().Auth.getAccessToken();
		if (!accessToken) throw new Error('no token');

		const syntheticEvent = {
			currentTarget: { files: [event.file] },
		} as unknown as Event;

		return new Promise<{ id: string; url: string }>((resolve, reject) => {
			fileUpload('errors.file_upload', accessToken, uploadUrl, allTypes, syntheticEvent, async (url) => {
				try {
					const response: ISendEventResponse = await this.sendToRoom(event, url, parentId, oldEvent);
					// dont revoke blobUrl
					resolve({ id: response.event_id, url });
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	/**
	 * Sends an attachment with the provided URI
	 * @param event The local attachment event content
	 * @param uri The URI of the uploaded file
	 * @param parentId The ID of the parent event
	 * @param oldEvent Optional existing event to be replaced
	 * @returns Promise with the result of sending the event
	 */
	private async sendToRoom(event: TLocalAttachmentMessageEventContent, uri: string, parentId: string, oldEvent?: TMessageEvent<TMessageEventContent>) {
		// Create the content based on whether we're replacing an attachment or creating a new one
		const content = this.buildMessageContent(event, uri, parentId, oldEvent);

		try {
			// eslint-disable-next-line -- temp code
			return await this.client.sendEvent(this.room.roomId, EventType.RoomMessage as any, content);
		} catch (error) {
			// eslint-disable-next-line -- temp code
			console.error(`swallowing add attachement`, { error });
			throw error;
		}
	}

	/**
	 * Builds the content object for an attachment message
	 */
	private buildMessageContent(event: TLocalAttachmentMessageEventContent, uri: string, parentId: string, oldEvent?: TMessageEvent<TMessageEventContent>) {
		const msgtype = event.msgtype;
		const file = event.file;
		const isImage = msgtype === MsgType.Image;
		const oldContent = oldEvent?.content as TImageMessageEventContent | TFileMessageEventContent;

		// Determine relation type based on whether we're replacing an existing attachment
		const relates = this.buildRelationType(parentId, oldEvent);

		// Build base content properties
		const content = this.buildBaseContent(file, uri, msgtype, isImage, relates, oldContent);

		// Add new_content if this is a replacement
		if (oldContent) {
			// eslint-disable-next-line -- temp code
			(content as any)['m.new_content'] = this.buildNewContent(file, uri, msgtype, isImage, parentId);
		}

		return content;
	}

	/**
	 * Builds the relation type object
	 */
	private buildRelationType(parentId: string, oldEvent?: TMessageEvent<TMessageEventContent>) {
		return oldEvent
			? {
					rel_type: 'm.replace',
					event_id: oldEvent.event_id,
				}
			: {
					'm.in_reply_to': {
						event_id: parentId,
					},
				};
	}

	/**
	 * Builds the base content for an attachment message
	 */
	private buildBaseContent(
		file: File,
		uri: string,
		msgtype: string,
		isImage: boolean,
		// eslint-disable-next-line -- temp code
		relates: any,
		oldContent?: TImageMessageEventContent | TFileMessageEventContent,
	) {
		// Common properties for both file and image
		const commonProps = {
			body: oldContent?.body || file.name,
			url: oldContent?.url || uri,
			info: {
				mimetype: oldContent?.info?.mimetype || file.type,
				size: oldContent?.info?.size || file.size,
			},
			msgtype,
			'm.relates_to': relates,
		};

		// Add filename only for files, not images
		return isImage
			? commonProps
			: {
					...commonProps,
					filename: (oldContent && this.isFileContent(oldContent) ? oldContent.filename : null) || file.name,
				};
	}

	/**
	 * Builds the new content for a replacement message
	 */
	private buildNewContent(file: File, uri: string, msgtype: string, isImage: boolean, parentId: string) {
		const newContentBase = {
			body: file.name,
			info: {
				mimetype: file.type,
				size: file.size,
			},
			msgtype,
			url: uri,
			'm.relates_to': {
				'm.in_reply_to': {
					event_id: parentId,
				},
			},
		};

		return isImage ? newContentBase : { ...newContentBase, filename: file.name };
	}

	/**
	 * Type guard to check if content is a file message
	 */
	private isFileContent(content: TImageMessageEventContent | TFileMessageEventContent): content is TFileMessageEventContent {
		return content.msgtype === MsgType.File;
	}
}
