/**
 * Status Message Id (SMI)
 * Shortened for readability in usage of log function.
 */
export enum SMI {
	ROOM_TIMELINE_TRACE = 'ROOM_TIMELINE_TRACE',
}

export enum LogLevel {
	DEBUG = '1',
	INFO = '2',
	NOTICE = '3',
	WARNING = '4',
	ERROR = '5',
	ALERT = '6',
	CRITICAL = '7',
}

export type TStatusMessageDefinition = {
	id: SMI;
	level: LogLevel;
};
