/**
 * This is a first draft for a 'status message'.
 * It could be used for logging, debugging, and error handling.
 *
 * The idea is that we can add more structure to errors and logs in the future.
 * For example, when we're debugging the roomtimeline, we might filter out the Status Messages with related SMI's.
 */

import { LogLevel } from '../foundation/statusTypes.js';

/**
 * Status Message Id (SMI)
 * Shortened for readability in usage of log function.
 */
export enum SMI {
	HUB_SETTINGS = 'HUB_SETTINGS',
	OTHER = 'OTHER',
	ROOM = 'ROOM_TRACE',
	ROOM_THREAD = 'ROOM_THREAD_TRACE',
	ROOM_TIMELINE = 'ROOM_TIMELINE_TRACE',
	ROOM_TIMELINEWINDOW = 'ROOM_TIMELINEWINDOW_TRACE',
	STARTUP = 'STARTUP_TRACE',
	STORE = 'STORE_TRACE',
	USER = 'USER',
	ERROR = 'ERROR',
}

// A StatusMessage instance could later have parameters and a stack trace passed to it.
export type TStatusMessageDefinition = {
	id: SMI;
	level: LogLevel;
};
