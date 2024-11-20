/**
 * This is a first draft for a 'status message'.
 * It could be used for logging, debugging, and error handling.
 *
 * The idea is that we can add more structure to errors and logs in the future.
 * For example, when we're debugging the roomtimeline, we might filter out the Status Messages with related SMI's.
 */

import { LogLevel } from './types';

/**
 * Status Message Id (SMI)
 * Shortened for readability in usage of log function.
 */
export enum SMI {
	ROOM_TIMELINE_TRACE = 'ROOM_TIMELINE_TRACE',
	ROOM_TIMELINEWINDOW_TRACE = 'ROOM_TIMELINEWINDOW_TRACE',
	ROOM_TRACE = 'ROOM_TRACE',
	STARTUP_TRACE = 'STARTUP_TRACE',
	STORE_TRACE = 'STORE_TRACE',
}

// A StatusMessage instance could later have parameters and a stack trace passed to it.
export type TStatusMessageDefinition = {
	id: SMI;
	level: LogLevel;
};
