/**
 * In-memory per-room unread state cache, backed by the LocalStore (encrypted
 * key/value store in the global client). The whole cache is serialized under a
 * single LocalStore key — one encryption per save instead of one per room —
 * and saves are scheduled at most once per second.
 *
 * Get and set are synchronous (the cache is a plain in-memory Map), so
 * Room.unreadState stays a synchronous function. Loading from disk runs as a
 * fire-and-forget Promise at startup; live updates that arrive before the
 * load completes are merged with the disk state via mergeStoredUnreadInfo,
 * which is associative AND commutative — see the merge function's comment.
 */
// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';
import { getLocalStoreItem, setLocalStoreItem } from '@hub-client/logic/utils/localStoreClient';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

const logger = createLogger('UnreadInfoCache');

const STORE_KEY = 'unreadInfoCache';
const SAVE_INTERVAL_MS = 1000;

/**
 * Cached per-room data used by Room.unreadState. Two monotonic numbers; both
 * advance via max during merge.
 *
 * - lastVisibleTs: the largest timestamp of a visible event we KNOW about for
 *   this room — i.e. the largest one we have ever seen in any timeline buffer
 *   for this room across this and previous sessions. NOT necessarily the
 *   actual most recent visible event in the room: there may be newer visible
 *   events we haven't fetched yet. The 'read' / 'unread' decision compares
 *   this against the user's read receipt: if the receipt is older than
 *   lastVisibleTs, the user has at least one known-but-unread visible event.
 *
 * - lastReadAllTs: the timestamp of the most recent moment at which we knew
 *   that ALL events up to and including that moment were read. Set when
 *   Room.unreadState computes 'read' — to the lastEventTs of the timeline at
 *   that moment, NOT necessarily to a visible event's timestamp. May be
 *   later than the read receipt timestamp because trailing state events past
 *   the last visible event still count as "read up to here". Optional:
 *   undefined when the room has never been computed as fully read in our
 *   records. Once set, only ever advances.
 */
export type StoredUnreadInfo = {
	lastVisibleTs: number;
	lastReadAllTs?: number;
};

const cache = new Map<string, StoredUnreadInfo>();
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/** Synchronous in-memory read. Returns null if no data for this room. */
export function getStoredUnreadInfo(roomId: string): StoredUnreadInfo | undefined {
	return cache.get(roomId);
}

/**
 * Merge new knowledge into stored unread info, in-memory. Schedules a
 * persistent save: at most one save runs per SAVE_INTERVAL_MS (1 second), so
 * a burst of N updates collapses into one save+encryption.
 */
export function updateStoredUnreadInfo(roomId: string, incoming: StoredUnreadInfo): void {
	const current = cache.get(roomId);
	const merged = current ? mergeStoredUnreadInfo(current, incoming) : incoming;
	if (current && storedUnreadInfoEqual(current, merged)) return;
	cache.set(roomId, merged);
	scheduleSave();
}

/**
 * Load the persisted cache from LocalStore and merge it into the in-memory
 * cache. Fire-and-forget at startup. Any live updates that have already
 * arrived (between module load and load completion) are preserved via the
 * associative+commutative merge — see mergeStoredUnreadInfo.
 */
export async function loadUnreadInfoCache(): Promise<void> {
	const raw = await getLocalStoreItem(STORE_KEY);
	if (!raw) return;
	let obj: Record<string, StoredUnreadInfo>;
	try {
		obj = JSON.parse(raw) as Record<string, StoredUnreadInfo>;
	} catch {
		logger.warn('Failed to parse stored unread info cache; ignoring');
		return;
	}
	for (const [roomId, diskInfo] of Object.entries(obj)) {
		const liveInfo = cache.get(roomId);
		cache.set(roomId, liveInfo ? mergeStoredUnreadInfo(diskInfo, liveInfo) : diskInfo);
	}
}

/**
 * Combine two StoredUnreadInfo records by advancing each monotonic field.
 *
 * This operation is "associative", meaning `(x * y) * z == x * (y * z)`,
 * which matters because loadUnreadInfoCache merges disk state into a cache
 * that may already contain live updates from before the load completed:
 * `disk * (y_1 * y_2) == (disk * y_1) * y_2` lets us merge once per disk
 * entry instead of replaying the live updates.
 *
 * The operation also happens to be commutative, `x * y == y * x`, but this
 * is not important for loadUnreadInfoCache's logic.
 *
 * unreadInfoCache.test.ts checks this exhaustively — a previous incarnation
 * of this function was more complicated.
 */
export function mergeStoredUnreadInfo(a: StoredUnreadInfo, b: StoredUnreadInfo): StoredUnreadInfo {
	return {
		lastVisibleTs: Math.max(a.lastVisibleTs, b.lastVisibleTs),
		lastReadAllTs: maxOptional(a.lastReadAllTs, b.lastReadAllTs),
	};
}

function maxOptional(a: number | undefined, b: number | undefined): number | undefined {
	if (a === undefined) return b;
	if (b === undefined) return a;
	return Math.max(a, b);
}

function storedUnreadInfoEqual(a: StoredUnreadInfo, b: StoredUnreadInfo): boolean {
	return a.lastVisibleTs === b.lastVisibleTs && a.lastReadAllTs === b.lastReadAllTs;
}

function scheduleSave(): void {
	if (saveTimeout) return;
	saveTimeout = setTimeout(() => {
		saveTimeout = null;
		void saveCache();
	}, SAVE_INTERVAL_MS);
}

async function saveCache(): Promise<void> {
	// Drop entries for rooms the user has left/been banned from. This is the
	// cleanup point for stale rooms — they get evicted from both the persisted
	// blob and the in-memory cache here. Matches the leave/ban skip in
	// MatrixService.handleLifecycleEvent that excludes those rooms from the
	// sidebar room list, so we end up with cache entries exactly for the rooms
	// that could potentially show a dot. client.getRooms() is a cheap
	// synchronous Object.values over the matrix-js-sdk's MemoryStore; see
	// node_modules/matrix-js-sdk/lib/store/memory.js.
	const joinedRoomIds = new Set(
		usePubhubsStore()
			.client.getRooms()
			.filter((r) => r.getMyMembership() === 'join')
			.map((r) => r.roomId),
	);
	const filtered: Record<string, StoredUnreadInfo> = {};
	for (const [roomId, info] of cache) {
		if (joinedRoomIds.has(roomId)) filtered[roomId] = info;
		else cache.delete(roomId);
	}
	await setLocalStoreItem(STORE_KEY, JSON.stringify(filtered));
}
