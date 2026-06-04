// Packages
import { storeToRefs } from 'pinia';
import { type Ref, ref, watch } from 'vue';

// Models
import type { UnreadState } from '@hub-client/models/rooms/TBaseRoom';
import { loadUnreadInfoCache } from '@hub-client/models/rooms/unreadInfoCache';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

/**
 * Reactive aggregate unread state for the hub the current iframe is
 * connected to. Shared between the hub client (App.vue) and the independent
 * miniclient (MiniclientIndependent.vue): both need the same sequence of
 *   - hydrating the persisted unread-info cache at startup (via the
 *     global-client-backed LocalStore),
 *   - recomputing per-room unread state once the cache has loaded,
 *   - keeping a reactive `unreadState` in sync with the store's
 *     `unreadCountVersion` bumps. The store bumps that counter on every
 *     `RoomEvent.Receipt` (via `MatrixService.roomUnreadNotifications` →
 *     `notifyUnreadCountChanged`), so receipts feed into this composable
 *     through the watch — no separate receipt subscription needed here.
 *
 * The composable does NOT log in — the caller is responsible for ensuring
 * the matrix client is ready AND the messagebox handshake with the global
 * client is complete before invoking `setupUnreadAggregateTracking()`. The
 * handshake precondition matters because the persisted cache is loaded via
 * the LocalStore protocol, which talks to the parent frame and would drop
 * messages if the messagebox isn't ready yet:
 *
 *   const { unreadState, setupUnreadAggregateTracking } = useUnreadAggregate();
 *   ...
 *   await startMessageBox();
 *   await pubhubs.login();
 *   await setupUnreadAggregateTracking();
 *
 * Callers react to state changes by watching `unreadState` directly.
 */
export function useUnreadAggregate(): { unreadState: Ref<UnreadState>; setupUnreadAggregateTracking: () => Promise<void> } {
	const rooms = useRooms();
	const { unreadCountVersion } = storeToRefs(rooms);
	const unreadState = ref<UnreadState>('unknown');

	async function refresh() {
		unreadState.value = await rooms.fetchAggregateUnreadState();
	}

	watch(unreadCountVersion, refresh);

	async function setupUnreadAggregateTracking() {
		// Fire-and-forget: hydrate the persisted cache from the global client
		// in parallel with the rest of startup. When it resolves, recompute
		// per-room unread states so any rooms that were 'unknown' before the
		// cache loaded get updated (which bumps unreadCountVersion and
		// refires the watch above, updating `unreadState`).
		void loadUnreadInfoCache().then(() => rooms.refreshAllUnreadStates());

		// Initial fetch so `unreadState` has a meaningful value immediately.
		await refresh();
	}

	return { unreadState, setupUnreadAggregateTracking };
}
