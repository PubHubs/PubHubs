import { SMI } from './StatusMessage';

/**
 * A first draft for more extensive logging.
 */
export class Logger {
	private name: string;

	public constructor(name: string) {
		this.name = name;
	}

	/**
	 *
	 * @param statusMessageId
	 * @param message a short message that will be shown in the logs for quick understanding
	 * @param params any relevant parameters from the context of where the log is called
	 */
	public log(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		if (this.shouldPrint(statusMessageId)) {
			console.groupCollapsed(`[${this.name} ${statusMessageId}] ${message}`);
			console.log('params: ', params);
			console.groupCollapsed('stack trace');
			console.trace();
			console.groupEnd();
			console.groupEnd();
		}
	}

	/**
	 * For now always returns true, but can decide based on SMI and configuration (prod vs dev) in the future
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private shouldPrint(statusMessageId: SMI): boolean {
		return true;
	}
}

// Hub client logger
const LOGGER = new Logger('HC');
export { LOGGER };
