import { LogLevel } from './statusTypes';
import Config, { CONFIG } from './Config';
import { SMI } from './StatusMessage.js';

type LogOptions = {
	level?: LogLevel;
};

/**
 * A simple logger that we can extend later if needed.
 *
 * The idea is that there is one global logger (for the hub client).
 * That allows the logger to collect all relevant logs in the future and then send them to the server on errors for example.
 *
 * Note that the startup order of these global objects matters. The Logger is dependent on the Config, so the Config can't use the Logger.
 *
 * The Logger is not a pinia store because you would first need to write logger = useLogger() in every pinia store action you'd want to use it in.
 * This discourages the use of the logger, which is already easy to forget to use.
 */
export class Logger {
	private name: string;
	private config: Config;

	public constructor(name: string, config: Config) {
		this.name = name;
		this.config = config;
	}

	/**
	 *
	 * @param statusMessageId
	 * @param message a short message that will be shown in the logs for quick understanding
	 * @param params any relevant parameters from the context of where the log is called
	 */
	public log(statusMessageId: SMI, message: string, params?: Record<string, any>, options?: LogOptions) {
		const logLevel = options?.level ?? LogLevel.Silent;

		if (this.shouldPrint(logLevel)) {
			console.groupCollapsed(`[${this.name} ${statusMessageId}] ${message}`);
			console.log('params: ', params);
			console.groupCollapsed('stack trace');
			console.trace();
			console.groupEnd();
			console.groupEnd();
		}
	}

	public trace(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		this.log(statusMessageId, message, params, { level: LogLevel.Trace });
	}

	public info(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		this.log(statusMessageId, message, params, { level: LogLevel.Info });
	}

	public warn(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		this.log(statusMessageId, message, params, { level: LogLevel.Warn });
	}

	public error(statusMessageId: SMI, message: string, params?: Record<string, any>) {
		this.log(statusMessageId, message, params, { level: LogLevel.Error });
	}

	private shouldPrint(logLevel: LogLevel): boolean {
		if (logLevel >= this.config.logLevelToStartLoggingFrom) {
			return true;
		} else {
			return false;
		}
	}
}

// Hub client logger
const LOGGER = new Logger('HC', CONFIG);
export { LOGGER };
