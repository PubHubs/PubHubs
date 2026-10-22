/**
 * Which servers can currently be reached, tracked per origin (PHC, each hub server), because one
 * server can be down while the others are fine. See docs/app/offline.md.
 *
 * Every JavaScript context (the app shell and each hub frame) has its own instance. The state is fed
 * by the outcome of real requests ({@link trackedFetch}), and by the window's online/offline events
 * as a hint: `navigator.onLine` is true on a wifi without internet, but an `offline` event reliably
 * means there is no network at all.
 *
 * While an origin is offline, a registered probe checks it with exponential backoff. When it comes
 * back, the handlers registered with {@link onReconnect} run in order, one run at a time.
 */
import { reactive } from 'vue';

import { NetworkError, isNetworkError } from '@hub-client/logic/core/networkError';
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('Reachability');

type Reachability = 'online' | 'offline' | 'unknown';
type Probe = () => Promise<unknown>;
type ReconnectHandler = () => Promise<void> | void;

const PROBE_BASE_DELAY_MS = 1_000;
const PROBE_MAX_DELAY_MS = 60_000;

const states = reactive(new Map<string, Reachability>());
const probes = new Map<string, Probe>();
const probeTimers = new Map<string, { attempt: number; timer: ReturnType<typeof setTimeout> | null }>();
const reconnectHandlers = new Map<string, ReconnectHandler[]>();
// Per origin: the reconnect run in progress, and whether another one was requested meanwhile.
const reconnectRuns = new Map<string, { running: Promise<void>; again: boolean }>();
// Per origin: callers of whenReachable still waiting.
const reachableWaiters = new Map<string, Array<() => void>>();

// Debug only, see installOfflineSimulation.
let simulatedOffline: Set<string> | 'all' | null = null;

// Set while this frame is being unloaded, see trackedFetch.
let unloading = false;

function originOf(url: string): string {
	try {
		return new URL(url, globalThis.location?.href).origin;
	} catch {
		return url;
	}
}

function reachabilityOf(url: string): Reachability {
	return states.get(originOf(url)) ?? 'unknown';
}

/** True unless the origin is known to be unreachable. */
function mayBeReachable(url: string): boolean {
	return reachabilityOf(url) !== 'offline';
}

function reportReachable(url: string): void {
	const origin = originOf(url);
	const previous = states.get(origin);
	if (previous === 'online') return;
	states.set(origin, 'online');
	stopProbing(origin);
	for (const resolve of reachableWaiters.get(origin) ?? []) resolve();
	reachableWaiters.delete(origin);
	if (previous === 'offline') {
		logger.info(`${origin} is reachable again`);
		runReconnect(origin);
	}
}

function reportUnreachable(url: string): void {
	const origin = originOf(url);
	if (states.get(origin) !== 'offline') {
		logger.info(`${origin} is unreachable`);
		states.set(origin, 'offline');
	}
	scheduleProbe(origin);
}

/** How to check whether `url`'s server is back: any answer counts, only a network error does not. */
function registerProbe(url: string, probe: Probe): void {
	const origin = originOf(url);
	probes.set(origin, probe);
	if (states.get(origin) === 'offline') scheduleProbe(origin);
}

/**
 * Resolves once `url`'s server is known to be reachable: right away if it is, otherwise after its probe
 * (see registerProbe), which runs immediately when nothing is known yet.
 */
function whenReachable(url: string): Promise<void> {
	const origin = originOf(url);
	if (states.get(origin) === 'online') return Promise.resolve();
	const waiting = new Promise<void>((resolve) => {
		reachableWaiters.set(origin, [...(reachableWaiters.get(origin) ?? []), resolve]);
	});
	if (states.get(origin) !== 'offline') scheduleProbe(origin, true);
	return waiting;
}

/**
 * Run `handler` every time `url`'s server becomes reachable again after having been unreachable.
 * Handlers of one origin run in registration order, and never twice at the same time.
 *
 * @returns a function that removes the handler.
 */
function onReconnect(url: string, handler: ReconnectHandler): () => void {
	const origin = originOf(url);
	const list = reconnectHandlers.get(origin) ?? [];
	list.push(handler);
	reconnectHandlers.set(origin, list);
	return () => {
		const current = reconnectHandlers.get(origin);
		if (current)
			reconnectHandlers.set(
				origin,
				current.filter((h) => h !== handler),
			);
	};
}

function runReconnect(origin: string): void {
	const run = reconnectRuns.get(origin);
	if (run) {
		run.again = true;
		return;
	}
	const entry = { running: Promise.resolve(), again: false };
	entry.running = (async () => {
		do {
			entry.again = false;
			for (const handler of [...(reconnectHandlers.get(origin) ?? [])]) {
				try {
					await handler();
				} catch (error) {
					logger.error(`A reconnect step for ${origin} failed`, { error });
				}
			}
		} while (entry.again);
		reconnectRuns.delete(origin);
	})();
	reconnectRuns.set(origin, entry);
}

function scheduleProbe(origin: string, immediately = false): void {
	const probe = probes.get(origin);
	if (!probe) return;
	const entry = probeTimers.get(origin) ?? { attempt: 0, timer: null };
	if (entry.timer !== null) {
		if (!immediately) return;
		clearTimeout(entry.timer);
	}
	// No point in probing without any network; the online event starts probing again.
	if (!immediately && globalThis.navigator?.onLine === false) {
		entry.timer = null;
		probeTimers.set(origin, entry);
		return;
	}
	const backoff = Math.min(PROBE_BASE_DELAY_MS * 2 ** entry.attempt, PROBE_MAX_DELAY_MS);
	// Jitter, so the shell and every hub frame don't all probe at the same moment.
	const delay = immediately ? 0 : backoff / 2 + Math.random() * (backoff / 2);
	entry.attempt += 1;
	entry.timer = setTimeout(async () => {
		entry.timer = null;
		try {
			await probe();
			reportReachable(origin);
		} catch (error) {
			if (isNetworkError(error)) {
				reportUnreachable(origin);
			} else {
				// The server answered, even if with an error.
				reportReachable(origin);
			}
		}
	}, delay);
	probeTimers.set(origin, entry);
}

function stopProbing(origin: string): void {
	const entry = probeTimers.get(origin);
	if (entry?.timer) clearTimeout(entry.timer);
	probeTimers.delete(origin);
}

function isSimulatedOffline(url: string): boolean {
	return simulatedOffline === 'all' || (simulatedOffline?.has(originOf(url)) ?? false);
}

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

/**
 * `fetch` that keeps the reachability state up to date: any response means the server is reachable,
 * a network error means it is not. Network errors are rethrown as {@link NetworkError}; an abort by
 * the caller is rethrown unchanged.
 *
 * Requests from a frame that is being unloaded (a hub frame is removed when the user leaves the hub)
 * are left pending instead: they would fail at once, and matrix-js-sdk retries some requests (the
 * push rules at the start of a sync) without any pause, which keeps the JavaScript thread the whole
 * app shares busy for good.
 */
async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	if (unloading) return new Promise<Response>(() => {});
	const url = requestUrl(input);
	if (isSimulatedOffline(url)) {
		reportUnreachable(url);
		throw new NetworkError(url, new TypeError('Failed to fetch (simulated offline)'));
	}
	let response: Response;
	try {
		response = await fetch(input, init);
	} catch (error) {
		if (isNetworkError(error)) {
			reportUnreachable(url);
			throw new NetworkError(url, error);
		}
		throw error;
	}
	reportReachable(url);
	return response;
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		for (const [origin, state] of states) {
			if (state !== 'offline') continue;
			const entry = probeTimers.get(origin);
			if (entry) entry.attempt = 0;
			scheduleProbe(origin, true);
		}
	});
	window.addEventListener('offline', () => {
		for (const origin of [...states.keys()]) reportUnreachable(origin);
	});
	window.addEventListener('pagehide', () => (unloading = true));
	// Back from the back/forward cache: the page is in use again.
	window.addEventListener('pageshow', () => (unloading = false));
}

declare global {
	interface Window {
		pubhubsSimulateOffline?: (target: boolean | string[]) => void;
	}
}

/**
 * Debug builds only: `pubhubsSimulateOffline(true)` in a context's console makes every request from
 * that context fail as if unreachable, `pubhubsSimulateOffline(['https://phc.example'])` only those
 * origins, and `pubhubsSimulateOffline(false)` stops it. Covers requests through {@link trackedFetch}.
 */
function installOfflineSimulation(): void {
	window.pubhubsSimulateOffline = (target) => {
		if (target === false) {
			simulatedOffline = null;
			for (const [origin, state] of states) {
				if (state === 'offline') scheduleProbe(origin, true);
			}
		} else {
			simulatedOffline = target === true ? 'all' : new Set(target.map(originOf));
			for (const origin of [...states.keys()]) {
				if (isSimulatedOffline(origin)) reportUnreachable(origin);
			}
		}
		logger.warn('Simulated offline:', { simulatedOffline });
	};
}

/** Tests only. */
function resetReachabilityForTests(): void {
	for (const origin of [...probeTimers.keys()]) stopProbing(origin);
	states.clear();
	probes.clear();
	reconnectHandlers.clear();
	reconnectRuns.clear();
	reachableWaiters.clear();
	simulatedOffline = null;
	unloading = false;
}

export {
	installOfflineSimulation,
	mayBeReachable,
	onReconnect,
	reachabilityOf,
	registerProbe,
	reportReachable,
	reportUnreachable,
	resetReachabilityForTests,
	trackedFetch,
	whenReachable,
	type Reachability,
};
