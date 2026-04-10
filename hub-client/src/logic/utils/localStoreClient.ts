/**
 * Hub-client side of the LocalStore protocol. The actual encrypted store lives
 * in the global client's localStorage (so it survives Safari's third-party
 * iframe restrictions); this module mirrors it as an in-memory cache and
 * persists writes via fire-and-forget messagebox messages.
 *
 * Backwards compatibility: when no hubId is present in the URL (solo mode,
 * older global client, direct URL access), the cache is in-memory only —
 * reads/writes still work, they just don't persist.
 *
 * Lazy init: getLocalStoreItem and setLocalStoreItem await whenReady()
 * internally, which kicks off the LocalStoreLoad/LocalStoreLoaded round trip
 * on first call. Callers don't need to call any explicit init.
 */
// Packages
import { sleep } from 'matrix-js-sdk/lib/utils';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';
import { hubId } from '@hub-client/logic/utils/hubId';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';

const logger = createLogger('LocalStoreClient');

// Timeout for waiting on LocalStoreLoaded after sending LocalStoreLoad. Needs
// to be generous enough for a slow handshake but short enough that callers
// don't hang on a missing/older global client.
const LOAD_TIMEOUT_MS = 2000;

const cache = new Map<string, string>();
let readyPromise: Promise<void> | null = null;

/** Read a value from the cache; awaits the initial load on first call. */
export async function getLocalStoreItem(key: string): Promise<string | null> {
	await whenReady();
	return cache.get(key) ?? null;
}

/**
 * Update the cache and fire-and-forget a LocalStoreUpdate to the global client.
 * Awaits the initial load first so a write doesn't race the load response.
 * In solo mode / older global clients, only the cache is updated.
 */
export async function setLocalStoreItem(key: string, value: string): Promise<void> {
	await whenReady();
	cache.set(key, value);
	if (!hubId) return;
	useMessageBox().sendMessage(new Message(MessageType.LocalStoreUpdate, { hubId, key, value }));
}

/** Lazy one-shot load. Idempotent — concurrent callers share the same promise. */
function whenReady(): Promise<void> {
	if (!readyPromise) readyPromise = loadFromGlobal();
	return readyPromise;
}

/** Send LocalStoreLoad and populate the cache from LocalStoreLoaded. */
async function loadFromGlobal(): Promise<void> {
	if (!hubId) {
		// Solo mode (running standalone without a global-client wrapper) is the
		// only legitimate "no hubId" case; otherwise it means the global client
		// hasn't been updated to embed hubId in the iframe URL.
		if (globalThis.self !== window.top) {
			logger.warn('No hubId found in iframe URL — running without persisted local store. This is unexpected if the global client is up-to-date.');
		}
		return;
	}
	const messagebox = useMessageBox();

	// Set up the response promise BEFORE sending so we don't miss the reply.
	const responsePromise = awaitMessage('parentFrame', MessageType.LocalStoreLoaded);
	messagebox.sendMessage(new Message(MessageType.LocalStoreLoad, { hubId }));

	const response = await Promise.race<Message | null>([responsePromise, sleep<null>(LOAD_TIMEOUT_MS, null)]);

	if (!response) {
		logger.warn(`LocalStoreLoaded did not arrive within ${LOAD_TIMEOUT_MS} ms — running without persisted local store`);
		return;
	}
	const data = response.content as Record<string, string>;
	for (const [k, v] of Object.entries(data)) {
		cache.set(k, v);
	}
}

/**
 * Wait for a single message of the given type from the parent frame and
 * resolve with it. Wraps the messagebox callback API as a one-shot promise.
 */
function awaitMessage(frameId: string, type: MessageType): Promise<Message> {
	const messagebox = useMessageBox();
	return new Promise((resolve) => {
		messagebox.addCallback(frameId, type, (message) => {
			messagebox.removeCallback(frameId, type);
			resolve(message);
		});
	});
}
