import { type MsgType } from 'matrix-js-sdk';

export interface TLocalAttachmentMessageEventContent {
	msgtype: MsgType.File | MsgType.Image;
	file: File;
	blobURL: string;
}
