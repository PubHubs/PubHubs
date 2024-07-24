/**
 * This is a first draft for a 'status message'.
 * It could be used for logging, debugging, and error handling.
 */

/**
 * Status Message Id (SMI)
 * Shortened for readability in usage of log function.
 */
export enum SMI {
	ROOM_TIMELINE_TRACE = 'ROOM_TIMELINE_TRACE',
}

export enum StatusMessageLevel {
	DEBUG = '1',
	INFO = '2',
	NOTICE = '3',
	WARNING = '4',
	ERROR = '5',
	ALERT = '6',
	CRITICAL = '7',
}

// A StatusMessage instance could later have parameters and a stack trace passed to it.
export type TStatusMessageDefinition = {
	id: SMI;
	level: StatusMessageLevel;
};
