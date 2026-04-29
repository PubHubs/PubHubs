// Packages
import { type EventType, type MsgType } from 'matrix-js-sdk';
// Types from Matrix SDK
import { type EncryptedFile, type FileInfo, type ImageInfo } from 'matrix-js-sdk/lib/@types/media';

// Logic
import { type PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import { type SignedMessage } from '@hub-client/models/components/signedMessages';
import { type TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { type TVotingWidgetMessageEventContent } from '@hub-client/models/events/voting/TVotingMessageEvent';
import { type WithRequired } from '@hub-client/models/utility/utility';

/**
 * Event used for sending messages in a room. Not limited to text.
 *
 * @see https://spec.matrix.org/v1.8/client-server-api/#events-2
 */
export interface TMessageEvent<C extends TMessageEventContent = TMessageEventContent> extends TBaseEvent {
	content: C;
	type: EventType.RoomMessage;
}

// In future Matrix spec some refacturing is needed: https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1767-extensible-events.md
export interface TBaseMessageEventContent {
	[key: string]: unknown;
	body?: string;
	// Custom body type, which has all the processed body or formatted body content, for use in our components
	ph_body?: string;
	userPL?: number;
	whisper_to?: string;
	msgtype:
		| MsgType.Text
		| MsgType.Image
		| MsgType.File
		| MsgType.Video
		| PubHubsMgType.SignedMessage
		| PubHubsMgType.AnnouncementMessage
		| PubHubsMgType.WhisperMessage
		| PubHubsMgType.VotingWidget
		| PubHubsMgType.VotingWidgetEdit
		| PubHubsMgType.VotingWidgetVote
		| PubHubsMgType.VotingWidgetClose
		| PubHubsMgType.VotingWidgetOpen
		| PubHubsMgType.VotingWidgetPickOption
		| PubHubsMgType.VotingWidgetAddVoteOption
		| PubHubsMgType.HideMessage
		| PubHubsMgType.VideoCall
		| PubHubsMgType.VideoCallEnded;
	'm.relates_to'?: {
		rel_type?: string;
		event_id?: string;
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
	msgtype: MsgType.Text;
	format?: 'org.matrix.custom.html';
	formatted_body?: string;
	'm.mentions': TMentions;
}

export interface TImageMessageEventContent extends TBaseMessageEventContent {
	msgtype: MsgType.Image;
	info?: ImageInfo;
	// We don't use encryption, so required
	url: string;
	filename?: string;
}

export interface TFileMessageEventContent extends TBaseMessageEventContent {
	msgtype: MsgType.File;
	file?: EncryptedFile;
	filename?: string;
	info?: FileInfo;
	url: string;
}

export interface TSignedMessageEventContent extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.SignedMessage;
	signed_message: SignedMessage;
}

interface TPrivilegedMessageEventContent extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.AnnouncementMessage | PubHubsMgType.WhisperMessage;
	userPL: number;
}

export interface TAnnouncementMessageEventContent extends TPrivilegedMessageEventContent {
	msgtype: PubHubsMgType.AnnouncementMessage;
}

export interface TWhisperMessageEventContent extends TPrivilegedMessageEventContent {
	msgtype: PubHubsMgType.WhisperMessage;
	whisper_to: string;
}

export interface TVideoCallMessageEventContent extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VideoCall;
	timestamp: number;
}

export interface TVideoCallEndedMessageEventContent extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VideoCallEnded;
	timestamp: number;
}
export interface THideMessageContent extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.HideMessage;
	ph_hidden_label: string | undefined;
}

export type IHTMLTextMessageEventContent = WithRequired<TTextMessageEventContent, 'format' | 'formatted_body'>;

export type TMessageEventContent =
	| TTextMessageEventContent
	| TImageMessageEventContent
	| TFileMessageEventContent
	| TSignedMessageEventContent
	| TPrivilegedMessageEventContent
	| TVotingWidgetMessageEventContent
	| TVideoCallMessageEventContent
	| TVideoCallEndedMessageEventContent;
