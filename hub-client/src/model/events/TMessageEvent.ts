import { SignedMessage } from '@/model/components/signedMessages';
import { WithRequired } from '../utility/utility';
import { TBaseEvent } from './TBaseEvent';

/**
 * Event used for sending messages in a room. Not limited to text.
 *
 * @see https://spec.matrix.org/v1.8/client-server-api/#events-2
 */
export interface TMessageEvent<C extends TMessageEventContent = TMessageEventContent> extends TBaseEvent {
	content: C;
	type: 'm.room.message';
}

// In future Matrix spec some refacturing is needed: https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1767-extensible-events.md
interface TBaseMessageEventContent {
	body: string;
	// Custom body type, which has all the processed body or formatted body content, for use in our components
	ph_body: string;
	msgtype: 'm.text' | 'm.image' | 'm.file' | 'pubhubs.signed_message';
	'm.relates_to'?: {
		'm.in_reply_to'?: {
			event_id: string;
		};
	};
}

export interface TMentions {
	room: boolean;
	user_ids: string[];
}

export interface TTextMessageEventContent extends TBaseMessageEventContent {
	msgtype: 'm.text';
	format?: 'org.matrix.custom.html';
	formatted_body?: string;
	'm.mentions': TMentions;
}

export interface TImageMessageEventContent extends TBaseMessageEventContent {
	msgtype: 'm.image';
	info?: ImageInfo;
	// We don't use encryption, so required
	url: string;
}

export interface TFileMessageEventContent extends TBaseMessageEventContent {
	msgtype: 'm.file';
	file?: EncryptedFile;
	filename?: string;
	info?: FileInfo;
	url?: string;
}

export interface TSignedMessageEventContent extends TBaseMessageEventContent {
	msgtype: 'pubhubs.signed_message';
	signed_message: SignedMessage;
}

export type IHTMLTextMessageEventContent = WithRequired<TTextMessageEventContent, 'format' | 'formatted_body'>;

export type TMessageEventContent = TTextMessageEventContent | TImageMessageEventContent | TFileMessageEventContent | TSignedMessageEventContent;

// To be implemented
type EncryptedFile = any;
type ImageInfo = any;
type FileInfo = any;
