import { SMI } from './StatusMessage';

class Logger {
	public log(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		console.groupCollapsed(`[${statusMessageId}] ${message}`);
		console.log('params: ', params);
		console.groupCollapsed('stack trace');
		console.trace();
		console.groupEnd();
		console.groupEnd();
	}

	/**
	 * For now always returns true, but can decide based on SMI and configuration (prod vs dev) in the future
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private shouldPrint(statusMessageId: SMI): boolean {
		return true;
	}
}

const LOGGER = new Logger();
export { LOGGER };
