export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	silent: 4,
};

function detectDefaultLevel(): LogLevel {
	try {
		if (import.meta.env?.PROD) return 'warn';
	} catch {
		// not available
	}
	return 'debug';
}

let globalLevel: LogLevel = detectDefaultLevel();

export function setLogLevel(level: LogLevel) {
	globalLevel = level;
}

export function getLogLevel(): LogLevel {
	return globalLevel;
}

export interface Logger {
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
}

export function createLogger(context: string): Logger {
	const prefix = `[${context}]`;

	function shouldLog(level: LogLevel): boolean {
		return LEVELS[level] >= LEVELS[globalLevel];
	}

	return {
		debug(...args: unknown[]) {
			if (shouldLog('debug')) console.debug(prefix, ...args); // eslint-disable-line no-console -- logger implementation
		},
		info(...args: unknown[]) {
			if (shouldLog('info')) console.info(prefix, ...args); // eslint-disable-line no-console -- logger implementation
		},
		warn(...args: unknown[]) {
			if (shouldLog('warn')) console.warn(prefix, ...args); // eslint-disable-line no-console -- logger implementation
		},
		error(...args: unknown[]) {
			if (shouldLog('error')) console.error(prefix, ...args); // eslint-disable-line no-console -- logger implementation
		},
	};
}
