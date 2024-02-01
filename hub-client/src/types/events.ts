import { SignedMessage } from '@/lib/signedMessages';
import { WithRequired } from './utility';
import { PluginProperties } from '@/store/plugins';

export type M_EventId = string;

export interface M_MessageEvent<C extends M_MessageEventContent = M_MessageEventContent> {
	content: C;
	event_id: string;
	origin_server_ts: number;
	room_id: string;
	sender: string;
	state_key?: string;
	type: string;
	// See matrix specification
	unsigned?: Record<string, any>;
	plugin?: PluginProperties | boolean;
}

interface M_BaseMessageEventContent {
	body: string;
	msgtype: 'm.text' | 'm.image' | 'm.file' | 'pubhubs.signed_message';
	'm.relates_to'?: {
		'm.in_reply_to'?: {
			event_id: string;
			// Custom extension, not in the matrix specification.
			x_event_copy?: M_MessageEvent;
		};
	};
}

export interface M_Mentions {
	room: boolean;
	user_ids: string[];
}

export interface M_TextMessageEventContent extends M_BaseMessageEventContent {
	msgtype: 'm.text';
	format?: 'org.matrix.custom.html';
	formatted_body?: string;
	'm.mentions': M_Mentions;
}

export interface M_ImageMessageEventContent extends M_BaseMessageEventContent {
	msgtype: 'm.image';
	info?: ImageInfo;
	// We don't use encryption, so required
	url: string;
}

export interface M_FileMessageEventContent extends M_BaseMessageEventContent {
	msgtype: 'm.file';
	file?: EncryptedFile;
	filename?: string;
	info?: FileInfo;
	url?: string;
}

export interface M_SignedMessageEventContent extends M_BaseMessageEventContent {
	msgtype: 'pubhubs.signed_message';
	signed_message: SignedMessage;
}

export type M_HTMLTextMessageEventContent = WithRequired<M_TextMessageEventContent, 'format' | 'formatted_body'>;

export type M_MessageEventContent = M_TextMessageEventContent | M_ImageMessageEventContent | M_FileMessageEventContent | M_SignedMessageEventContent;

// To be implemented
type EncryptedFile = any;
type ImageInfo = any;
type FileInfo = any;
