// Packages
import type { MatrixClient, Room as MatrixRoom } from 'matrix-js-sdk';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';

// Stores
import type { TPublicRoom } from '@hub-client/stores/rooms';

/**
 * Small pure helper that ensures only one instance of an async operation runs at a time.
 * stateHolder must be an object so the function can mutate .current by reference.
 */
export async function ensureSingleExecution<T>(stateHolder: { current: Promise<T> | null }, fn: () => Promise<T>): Promise<T> {
	if (stateHolder.current) {
		return stateHolder.current;
	}

	const p = (async () => {
		try {
			return await fn();
		} finally {
			stateHolder.current = null;
		}
	})();

	stateHolder.current = p;
	return p;
}

/**
 * Returns array of roomIds that are in joinedRooms but not present in knownRooms.
 * Pure helper so it can be unit tested easily.
 */
export function findRoomsToRejoin(joinedRooms: string[], knownRooms: MatrixRoom[]): string[] {
	const knownIds = new Set(knownRooms.map((r) => r.roomId));
	return joinedRooms.filter((id) => !knownIds.has(id));
}
