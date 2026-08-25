import { type MsgType } from 'matrix-js-sdk';

export interface FileInfo {
	mxcUrl: string;
	previewUrl?: string;
	filename: string;
	mimetype?: string;
	size?: number;
	msgtype: MsgType;
}
