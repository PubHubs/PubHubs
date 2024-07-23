import { SMI } from './StatusMessage';

export function log(statusMessageId: SMI, message: string, params?: Record<string, any>) {
	console.groupCollapsed(`[${statusMessageId}] ${message}`);
	console.log('params: ', params);
	console.groupCollapsed('stack trace');
	console.trace();
	console.groupEnd();
	console.groupEnd();
}
